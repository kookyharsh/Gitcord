import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findCommit } from '../storage/commits.js';
import { diffCommits } from '../diff/index.js';
import { logToChannel } from '../utils/logger.js';

export async function handleDiff(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const commitA = interaction.options.getString('commit_a', true);
  const commitB = interaction.options.getString('commit_b', true);

  const a = await findCommit(commitA);
  const b = await findCommit(commitB);

  if (!a || !b) {
    await interaction.editReply({ content: 'One or both commit IDs not found.' });
    return;
  }

  const diff = diffCommits(a.roles, a.channels, b.roles, b.channels);

  const embed = new EmbedBuilder()
    .setTitle(`Diff: ${commitA.slice(0, 12)} → ${commitB.slice(0, 12)}`)
    .setColor(0xF1C40F)
    .addFields(
      { name: 'Roles', value: formatDiffCounts(diff.added_roles.length, diff.removed_roles.length, diff.modified_roles.length), inline: true },
      { name: 'Channels', value: formatDiffCounts(diff.added_channels.length, diff.removed_channels.length, diff.modified_channels.length), inline: true },
    );

  const details: string[] = [];
  for (const r of diff.added_roles) details.push(`➕ Role \`${r.item.name}\``);
  for (const r of diff.removed_roles) details.push(`➖ Role \`${r.item.name}\``);
  for (const r of diff.modified_roles) details.push(`🔄 Role \`${r.item.name}\``);
  for (const c of diff.added_channels) details.push(`➕ Channel \`${c.item.name}\``);
  for (const c of diff.removed_channels) details.push(`➖ Channel \`${c.item.name}\``);
  for (const c of diff.modified_channels) details.push(`🔄 Channel \`${c.item.name}\``);

  if (details.length > 0) {
    embed.setDescription(details.slice(0, 25).join('\n'));
    if (details.length > 25) {
      embed.setFooter({ text: `...and ${details.length - 25} more changes` });
    }
  } else {
    embed.setDescription('No differences found.');
  }

  await interaction.editReply({ embeds: [embed] });

  const diffCount = formatDiffCounts(diff.added_roles.length, diff.removed_roles.length, diff.modified_roles.length);
  await logToChannel(interaction.client, interaction.guildId!,
    new EmbedBuilder()
      .setTitle('👁️ Diff Viewed')
      .setColor(0xF1C40F)
      .setDescription(`${commitA.slice(0, 12)} → ${commitB.slice(0, 12)} by ${interaction.user.tag}`)
      .addFields(
        { name: 'Roles', value: diffCount, inline: true },
        { name: 'Channels', value: formatDiffCounts(diff.added_channels.length, diff.removed_channels.length, diff.modified_channels.length), inline: true },
      )
      .setTimestamp(),
  );
}

function formatDiffCounts(added: number, removed: number, modified: number): string {
  const parts: string[] = [];
  if (added) parts.push(`+${added}`);
  if (removed) parts.push(`-${removed}`);
  if (modified) parts.push(`~${modified}`);
  return parts.join(' ') || '0';
}
