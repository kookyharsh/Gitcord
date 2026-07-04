import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findCommit } from '../../storage/commits.js';
import { snapshotGuild } from '../../snapshotter/index.js';
import { diffCommits } from '../../diff/index.js';

export async function handlePreview(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const commitId = interaction.options.getString('commit_id', true);
  const commit = await findCommit(commitId);

  if (!commit) {
    await interaction.editReply({ content: 'Commit not found.' });
    return;
  }

  const live = await snapshotGuild(interaction.guild!);
  const diff = diffCommits(commit.roles, commit.channels, live.roles, live.channels);

  const embed = new EmbedBuilder()
    .setTitle(`Preview: ${commitId.slice(0, 12)} vs Live`)
    .setColor(0x9B59B6)
    .addFields(
      { name: 'Roles', value: formatPreviewCounts(diff.added_roles.length, diff.removed_roles.length, diff.modified_roles.length), inline: true },
      { name: 'Channels', value: formatPreviewCounts(diff.added_channels.length, diff.removed_channels.length, diff.modified_channels.length), inline: true },
    );

  const details: string[] = [];
  for (const r of diff.added_roles) details.push(`🟢 Role to create: \`${r.item.name}\``);
  for (const r of diff.removed_roles) details.push(`🔴 Role to delete: \`${r.item.name}\``);
  for (const r of diff.modified_roles) details.push(`🟡 Role to update: \`${r.item.name}\``);
  for (const c of diff.added_channels) details.push(`🟢 Channel to create: \`${c.item.name}\``);
  for (const c of diff.removed_channels) details.push(`🔴 Channel to delete: \`${c.item.name}\``);
  for (const c of diff.modified_channels) details.push(`🟡 Channel to update: \`${c.item.name}\``);

  if (details.length > 0) {
    embed.setDescription(details.slice(0, 25).join('\n'));
    if (details.length > 25) {
      embed.setFooter({ text: `...and ${details.length - 25} more changes` });
    }
  } else {
    embed.setDescription('Guild is identical to this commit.');
  }

  await interaction.editReply({ embeds: [embed] });
}

function formatPreviewCounts(added: number, removed: number, modified: number): string {
  const parts: string[] = [];
  if (added) parts.push(`+${added}`);
  if (removed) parts.push(`-${removed}`);
  if (modified) parts.push(`~${modified}`);
  return parts.join(' ') || '0';
}