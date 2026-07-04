import { Job, Worker, Queue } from 'bullmq';
import { Client, EmbedBuilder } from 'discord.js';
import { findCommit } from '../storage/commits.js';
import { getConfig, updateConfig } from '../storage/config.js';
import { snapshotGuild } from '../snapshotter/index.js';
import { buildRestorePlan } from '../restore/planner.js';
import { executeRestore, ProgressReport } from '../restore/executor.js';
import { insertAuditLog } from '../storage/audit.js';
import { logToChannel } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function redisConnection() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

export const rollbackQueue = new Queue('rollback', { connection: redisConnection() });

interface RollbackPayload {
  server_id: string;
  commit_id: string;
  guild_id: string;
  user_id: string;
  channel_id: string;
}

export function startRollbackWorker(client: Client): void {
  const worker = new Worker<RollbackPayload>(
    'rollback',
    async job => {
      const { server_id, commit_id, guild_id, channel_id } = job.data;

      const guild = client.guilds.cache.get(guild_id);
      if (!guild) throw new Error('Guild not found');

      const target = await findCommit(commit_id);
      if (!target) throw new Error('Commit not found');

      const config = await getConfig(server_id);
      const live = await snapshotGuild(guild);
      const plan = buildRestorePlan(
        target.roles,
        target.channels,
        live.roles,
        live.channels,
        config.protected_role_ids,
        config.protected_channel_ids,
      );

      plan.commit_id = commit_id;
      plan.server_id = server_id;

      const channel = guild.channels.cache.get(channel_id);
      if (!channel || !channel.isTextBased()) throw new Error('Target channel not found');

      const progressMap = new Map<string, string>();

      const result = await executeRestore(guild, plan, async (report: ProgressReport) => {
        const status = report.ok ? '✅' : '❌';
        progressMap.set(String(report.step), `${status} ${report.label} (${report.ok ? 'OK' : `FAILED: ${report.error}`})`);

        const progressMsg = [...progressMap.entries()]
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, v]) => v)
          .join('\n');

        try {
          // Edit a progress message in the channel
          const messages = await channel.messages.fetch({ limit: 1 });
          const lastMsg = messages.first();
          if (lastMsg && lastMsg.author.id === client.user?.id) {
            await lastMsg.edit(`**Rollback progress:**\n${progressMsg}`);
          } else {
            await channel.send(`**Rollback progress:**\n${progressMsg}`);
          }
        } catch {
          // Ignore message edit failures
        }
      });

      if (result.success) {
        await updateConfig(server_id, { head_commit_id: commit_id });

        await logToChannel(client, server_id,
          new EmbedBuilder()
            .setTitle('✅ Rollback Completed')
            .setColor(0x2ECC71)
            .setDescription(`Rolled back to \`${commit_id.slice(0, 12)}\``)
            .setTimestamp(),
        );

        await channel.send(`✅ Rollback to \`${commit_id.slice(0, 12)}\` completed.`);
      } else {
        await logToChannel(client, server_id,
          new EmbedBuilder()
            .setTitle('❌ Rollback Failed')
            .setColor(0xE74C3C)
            .setDescription(`Rollback to \`${commit_id.slice(0, 12)}\` failed at step: ${result.lastStep}`)
            .setTimestamp(),
        );

        await channel.send(`❌ Rollback failed at step: ${result.lastStep}. Manual intervention required.`);
      }

      await insertAuditLog({
        server_id,
        user_id: job.data.user_id,
        command: 'rollback',
        commit_id,
        result: result.success ? 'success' : 'failure',
        timestamp: new Date().toISOString(),
        details: { lastStep: result.lastStep },
      });
    },
    { connection: redisConnection() },
  );

  worker.on('error', err => console.error('Rollback worker error:', err));
}
