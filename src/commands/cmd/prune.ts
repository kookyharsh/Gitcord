import { ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { findCommitsOlderThan, deleteCommits } from '../../storage/commits.js';
import { getConfig } from '../../storage/config.js';
import { insertAuditLog } from '../../storage/audit.js';
import { logToChannel } from '../../utils/logger.js';

export async function handlePrune(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.editReply({ content: 'You need `MANAGE_GUILD` permission to prune.' });
    return;
  }

  const server_id = interaction.guildId!;
  const days = interaction.options.getInteger('days', true);
  const config = await getConfig(server_id);

  const maxDays = config.retention_days;
  if (days > maxDays) {
    await interaction.editReply({ content: `Cannot prune more than ${maxDays} days (guild config limit).` });
    return;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const oldCommits = await findCommitsOlderThan(server_id, cutoff);

  if (oldCommits.length === 0) {
    await interaction.editReply({ content: 'No commits older than that threshold.' });
    return;
  }

  const headCommitId = config.head_commit_id;
  const toDelete = oldCommits
    .filter(c => c.commit_id !== headCommitId)
    .map(c => c.commit_id);

  if (toDelete.length === 0) {
    await interaction.editReply({ content: 'Only the head commit matches — skipping to preserve branch integrity.' });
    return;
  }

  const deleted = await deleteCommits(toDelete);

  await insertAuditLog({
    server_id,
    user_id: interaction.user.id,
    command: 'prune',
    result: 'success',
    timestamp: new Date().toISOString(),
    details: { pruned_count: deleted, older_than_days: days },
  });

  const embed = new EmbedBuilder()
    .setTitle('Prune Complete')
    .setColor(0xE67E22)
    .setDescription(`Deleted ${deleted} commits older than ${days} days.`)
    .setFooter({ text: `Kept head commit: ${headCommitId?.slice(0, 12) ?? 'none'}` });

  await interaction.editReply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('🗑️ Prune Executed')
      .setColor(0xE67E22)
      .setDescription(`Deleted ${deleted} commits older than ${days} days by ${interaction.user.tag}`)
      .setTimestamp(),
  );
}
