import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findCommit } from '../../storage/commits.js';
import { getConfig } from '../../storage/config.js';
import { snapshotGuild } from '../../snapshotter/index.js';
import { diffCommits } from '../../diff/index.js';

export async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const server_id = interaction.guildId!;
  const config = await getConfig(server_id);

  const embed = new EmbedBuilder()
    .setTitle('Gitcord Status')
    .setColor(0x5865F2)
    .addFields(
      { name: 'Head Commit', value: config.head_commit_id?.slice(0, 12) ?? 'None', inline: true },
      { name: 'Retention', value: `${config.retention_days} days`, inline: true },
    );

  if (config.head_commit_id) {
    const head = await findCommit(config.head_commit_id);
    if (head) {
      embed.addFields(
        { name: 'Last Snapshot', value: head.message, inline: false },
        { name: 'Author', value: head.author_tag, inline: true },
        { name: 'Timestamp', value: new Date(head.timestamp).toLocaleString(), inline: true },
        { name: 'Channels / Roles', value: `${head.meta.channel_count} / ${head.meta.role_count}`, inline: true },
      );
    }
  }

  // Show staged changes by comparing live state with head commit
  if (config.head_commit_id) {
    const head = await findCommit(config.head_commit_id);
    if (head) {
      const live = await snapshotGuild(interaction.guild!);
      const diff = diffCommits(head.roles, head.channels, live.roles, live.channels);
      
      const changes = formatStagedChanges(diff);
      if (changes) {
        embed.addFields({ name: 'Staged Changes', value: changes, inline: false });
      }
    }
  }

  await interaction.reply({ embeds: [embed] });
}

function formatStagedChanges(diff: ReturnType<typeof diffCommits>): string {
  const parts: string[] = [];
  
  if (diff.added_roles.length) parts.push(`➕ ${diff.added_roles.length} role(s) added`);
  if (diff.removed_roles.length) parts.push(`➖ ${diff.removed_roles.length} role(s) removed`);
  if (diff.modified_roles.length) parts.push(`🔄 ${diff.modified_roles.length} role(s) modified`);
  if (diff.added_channels.length) parts.push(`➕ ${diff.added_channels.length} channel(s) added`);
  if (diff.removed_channels.length) parts.push(`➖ ${diff.removed_channels.length} channel(s) removed`);
  if (diff.modified_channels.length) parts.push(`🔄 ${diff.modified_channels.length} channel(s) modified`);
  
  return parts.join(' | ') || 'No staged changes';
}