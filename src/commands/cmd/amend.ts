import { ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { snapshotGuild } from '../../snapshotter/index.js';
import { computeCommitId } from '../../utils/index.js';
import { insertCommit, findCommit, listCommits } from '../../storage/commits.js';
import { getConfig, updateConfig } from '../../storage/config.js';
import { insertAuditLog } from '../../storage/audit.js';
import { logToChannel } from '../../utils/logger.js';
import { diffCommits } from '../../diff/index.js';

export async function handleAmend(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.editReply({ content: 'You need `MANAGE_GUILD` permission to amend.' });
    return;
  }

  const guild = interaction.guild!;
  const server_id = guild.id;
  const message = interaction.options.getString('message', true);

  const config = await getConfig(server_id);
  
  if (!config.head_commit_id) {
    await interaction.editReply({ content: 'No commits to amend. Use `/commit` first.' });
    return;
  }

  const headCommit = await findCommit(config.head_commit_id);
  if (!headCommit) {
    await interaction.editReply({ content: 'Head commit not found.' });
    return;
  }

  const snapshot = await snapshotGuild(guild);
  const parent_ids = headCommit.parent_ids;

  const commit_id = computeCommitId(
    server_id,
    parent_ids,
    interaction.user.id,
    interaction.user.tag,
    message,
    snapshot.channels,
    snapshot.roles,
  );

  const existing = await findCommit(commit_id);
  if (existing) {
    await interaction.editReply({ content: 'Identical state already committed — no changes detected.' });
    return;
  }

  const diff = diffCommits(headCommit.roles, headCommit.channels, snapshot.roles, snapshot.channels);
  
  const commit = {
    commit_id,
    server_id,
    parent_ids,
    author_id: interaction.user.id,
    author_tag: interaction.user.tag,
    timestamp: new Date().toISOString(),
    message,
    channels: snapshot.channels,
    roles: snapshot.roles,
    meta: {
      channel_count: snapshot.channels.length,
      role_count: snapshot.roles.length,
    },
  };

  await insertCommit(commit);
  await updateConfig(server_id, { head_commit_id: commit_id });

  await insertAuditLog({
    server_id,
    user_id: interaction.user.id,
    command: 'amend',
    commit_id,
    result: 'success',
    timestamp: new Date().toISOString(),
    details: { amended_commit: headCommit.commit_id.slice(0, 12) },
  });

  const changes = formatDiffForDisplay(diff);
  
  const embed = new EmbedBuilder()
    .setTitle('Commit Amended')
    .setColor(0xF1C40F)
    .setDescription(`\`${commit_id.slice(0, 12)}\` — ${message}`)
    .addFields(
      { name: 'Previous Commit', value: `\`${headCommit.commit_id.slice(0, 12)}\``, inline: true },
      { name: 'Channels', value: String(snapshot.channels.length), inline: true },
      { name: 'Roles', value: String(snapshot.roles.length), inline: true },
    )
    .setFooter({ text: `by ${interaction.user.tag} (amended)` });

  if (changes) {
    embed.addFields({ name: 'Changes', value: changes, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('📝 Commit Amended')
      .setColor(0xF1C40F)
      .setDescription(`\`${commit_id.slice(0, 12)}\` — ${message}`)
      .addFields(
        { name: 'Previous', value: `\`${headCommit.commit_id.slice(0, 12)}\``, inline: true },
        { name: 'Author', value: interaction.user.tag, inline: true },
        { name: 'Channels / Roles', value: `${snapshot.channels.length} / ${snapshot.roles.length}`, inline: true },
      )
      .setTimestamp(),
  );
}

function formatDiffForDisplay(diff: ReturnType<typeof diffCommits>): string {
  const parts: string[] = [];
  
  if (diff.added_roles.length) parts.push(`➕ Roles: ${diff.added_roles.map(r => r.item.name).join(', ')}`);
  if (diff.removed_roles.length) parts.push(`➖ Roles: ${diff.removed_roles.map(r => r.item.name).join(', ')}`);
  if (diff.modified_roles.length) parts.push(`🔄 Roles: ${diff.modified_roles.map(r => r.item.name).join(', ')}`);
  if (diff.added_channels.length) parts.push(`➕ Channels: ${diff.added_channels.map(c => c.item.name).join(', ')}`);
  if (diff.removed_channels.length) parts.push(`➖ Channels: ${diff.removed_channels.map(c => c.item.name).join(', ')}`);
  if (diff.modified_channels.length) parts.push(`🔄 Channels: ${diff.modified_channels.map(c => c.item.name).join(', ')}`);
  
  return parts.join('\n') || 'No changes';
}