import { Guild, ChannelType } from 'discord.js';
import { RestorePlan, ChannelSnapshot } from '../types/index.js';

const RATE_LIMIT_DELAY = 1500;

async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export interface ProgressReport {
  step: number;
  total: number;
  label: string;
  ok: boolean;
  error?: string;
}

export async function executeRestore(
  guild: Guild,
  plan: RestorePlan,
  onProgress: (report: ProgressReport) => Promise<void>,
): Promise<{ success: boolean; lastStep: string }> {
  const steps = [
    { label: 'Create missing roles', count: plan.create_roles.length },
    { label: 'Update role permissions + positions', count: plan.update_roles.length },
    { label: 'Create categories + channels', count: plan.create_channels.length },
    { label: 'Update channel settings + overwrites', count: plan.update_channels.length },
    { label: 'Reorder channels', count: plan.reorder_channels.length },
    { label: 'Delete flagged objects', count: plan.delete_ids.length },
  ];

  const totalSteps = steps.length;
  let currentStep = 0;

  try {
    currentStep++;
    for (const role of plan.create_roles) {
      await guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions as never,
        mentionable: role.mentionable,
        reason: 'Gitcord restore',
      });
      await delay(RATE_LIMIT_DELAY);
    }
    await onProgress({ step: 1, total: totalSteps, label: 'Create missing roles', ok: true });

    currentStep++;
    for (const role of plan.update_roles) {
      const existing = guild.roles.cache.get(role.id);
      if (existing) {
        await existing.edit({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          permissions: role.permissions as never,
          mentionable: role.mentionable,
          reason: 'Gitcord restore',
        });
        await delay(RATE_LIMIT_DELAY);
      }
    }
    await onProgress({ step: 2, total: totalSteps, label: 'Update role permissions + positions', ok: true });

    currentStep++;
    const creatableTypes = new Set([
      ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory,
      ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice,
      ChannelType.GuildForum, ChannelType.GuildMedia,
    ]);
    for (const ch of plan.create_channels) {
      if (!creatableTypes.has(ch.type as ChannelType)) continue;
      await guild.channels.create({
        name: ch.name,
        type: ch.type as ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory | ChannelType.GuildAnnouncement | ChannelType.GuildStageVoice | ChannelType.GuildForum | ChannelType.GuildMedia,
        parent: ch.parent_id ?? undefined,
        topic: ch.topic ?? undefined,
        nsfw: ch.nsfw,
        bitrate: ch.bitrate ?? undefined,
        userLimit: ch.user_limit ?? undefined,
        rateLimitPerUser: ch.rate_limit_per_user ?? undefined,
        reason: 'Gitcord restore',
      });
      await delay(RATE_LIMIT_DELAY);
    }
    await onProgress({ step: 3, total: totalSteps, label: 'Create categories + channels', ok: true });

    currentStep++;
    for (const ch of plan.update_channels) {
      const existing = guild.channels.cache.get(ch.id);
      if (existing?.isTextBased()) {
        await existing.edit({
          name: ch.name,
          topic: ch.topic ?? undefined,
          nsfw: ch.nsfw,
          rateLimitPerUser: ch.rate_limit_per_user ?? undefined,
          reason: 'Gitcord restore',
        });
        await delay(RATE_LIMIT_DELAY);
      }
    }
    await onProgress({ step: 4, total: totalSteps, label: 'Update channel settings + overwrites', ok: true });

    currentStep++;
    for (const rc of plan.reorder_channels) {
      const existing = guild.channels.cache.get(rc.id);
      if (existing) {
        await existing.edit({ position: rc.position, reason: 'Gitcord restore' });
        await delay(RATE_LIMIT_DELAY);
      }
    }
    await onProgress({ step: 5, total: totalSteps, label: 'Reorder channels', ok: true });

    currentStep++;
    for (const del of plan.delete_ids) {
      if (del.type === 'channel') {
        const ch = guild.channels.cache.get(del.id);
        if (ch) await ch.delete('Gitcord restore');
      } else {
        const role = guild.roles.cache.get(del.id);
        if (role) await role.delete('Gitcord restore');
      }
      await delay(RATE_LIMIT_DELAY);
    }
    await onProgress({ step: 6, total: totalSteps, label: 'Delete flagged objects', ok: true });

    return { success: true, lastStep: 'complete' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await onProgress({
      step: currentStep,
      total: totalSteps,
      label: steps[currentStep - 1]?.label ?? 'unknown',
      ok: false,
      error: errorMsg,
    });
    return { success: false, lastStep: steps[currentStep - 1]?.label ?? 'unknown' };
  }
}
