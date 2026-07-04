import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ComponentType,
} from 'discord.js';
import { findCommit } from '../storage/commits.js';
import { getConfig } from '../storage/config.js';
import { snapshotGuild } from '../snapshotter/index.js';
import { buildRestorePlan } from '../restore/planner.js';
import { rollbackQueue } from '../jobs/rollback.js';
import { insertAuditLog } from '../storage/audit.js';
import { logToChannel } from '../utils/logger.js';

export async function handleRollback(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need `MANAGE_GUILD` permission to rollback.', ephemeral: true });
    return;
  }

  const server_id = interaction.guildId!;
  const commitId = interaction.options.getString('commit_id', true);

  const commit = await findCommit(commitId);
  if (!commit) {
    await interaction.reply({ content: 'Commit not found.', ephemeral: true });
    return;
  }

  const config = await getConfig(server_id);

  // Check cooldown
  if (config.rollback_cooldown_seconds > 0 && config.head_commit_id) {
    const lastAudit = await getLastRollback(server_id);
    if (lastAudit) {
      const elapsed = (Date.now() - new Date(lastAudit.timestamp).getTime()) / 1000;
      if (elapsed < config.rollback_cooldown_seconds) {
        const remaining = Math.ceil(config.rollback_cooldown_seconds - elapsed);
        await interaction.reply({
          content: `Rollback on cooldown. Try again in ${remaining} seconds.`,
          ephemeral: true,
        });
        return;
      }
    }
  }

  const live = await snapshotGuild(interaction.guild!);
  const plan = buildRestorePlan(
    commit.roles,
    commit.channels,
    live.roles,
    live.channels,
    config.protected_role_ids,
    config.protected_channel_ids,
  );

  const totalOps = plan.create_roles.length + plan.update_roles.length +
    plan.create_channels.length + plan.update_channels.length +
    plan.reorder_channels.length + plan.delete_ids.length;

  const embed = new EmbedBuilder()
    .setTitle('Confirm Rollback')
    .setColor(0xE74C3C)
    .setDescription(`Roll back to \`${commitId.slice(0, 12)}\`?`)
    .addFields(
      { name: 'Operations', value: `${totalOps} changes will be applied`, inline: false },
      { name: 'Protected Roles Skipped', value: String(config.protected_role_ids.length), inline: true },
      { name: 'Protected Channels Skipped', value: String(config.protected_channel_ids.length), inline: true },
    )
    .setFooter({ text: 'This action cannot be fully undone.' });

  const confirmId = 'confirm_rollback';
  const cancelId = 'cancel_rollback';

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

  const reply = await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: 'Only the command author can confirm.', ephemeral: true });
      return;
    }

    if (i.customId === cancelId) {
      await i.update({ content: 'Rollback cancelled.', embeds: [], components: [] });
      await insertAuditLog({
        server_id,
        user_id: interaction.user.id,
        command: 'rollback',
        commit_id: commitId,
        result: 'cancelled',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (i.customId === confirmId) {
      await i.update({
        content: 'Rollback queued. Check this channel for progress.',
        embeds: [],
        components: [],
      });

      await rollbackQueue.add('rollback', {
        server_id,
        commit_id: commitId,
        guild_id: interaction.guildId!,
        user_id: interaction.user.id,
        channel_id: interaction.channelId,
      });

      await logToChannel(interaction.client, server_id,
        new EmbedBuilder()
          .setTitle('🔄 Rollback Queued')
          .setColor(0xF1C40F)
          .setDescription(`Rollback to \`${commitId.slice(0, 12)}\` queued by ${interaction.user.tag}`)
          .addFields(
            { name: 'Operations', value: `${totalOps} changes`, inline: true },
          )
          .setTimestamp(),
      );
    }
  });

  collector.on('end', async () => {
    row.components.forEach(c => c.setDisabled(true));
    try {
      await interaction.editReply({ components: [row] });
    } catch {
      // ignore
    }
  });
}

async function getLastRollback(server_id: string) {
  const { listAuditLogs } = await import('../storage/audit.js');
  const logs = await listAuditLogs(server_id, 5);
  return logs.find(l => l.command === 'rollback' && l.result === 'success') ?? null;
}
