import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { findCommit } from '../../storage/commits.js';
import { getConfig } from '../../storage/config.js';
import { snapshotGuild } from '../../snapshotter/index.js';
import { diffCommits } from '../../diff/index.js';
import { RoleSnapshot, ChannelSnapshot } from '../../types/index.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show current branch, head commit info, and staged changes');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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

      const live = await snapshotGuild(interaction.guild!);
      const diff = diffCommits(head.roles, head.channels, live.roles, live.channels);
      
      const summary = formatSummary(diff);
      const details = formatDetails(diff);
      
      if (summary) {
        embed.addFields({ name: 'Changes Since Last Commit', value: summary, inline: false });
      }
      if (details) {
        embed.addFields({ name: 'Details', value: details, inline: false });
      }
    }
  } else {
    // No commits yet - show current guild state
    const live = await snapshotGuild(interaction.guild!);
    embed.addFields(
      { name: 'Current Guild State', value: `${live.channels.length} channels / ${live.roles.length} roles`, inline: false }
    );
  }

  await interaction.reply({ embeds: [embed] });
}

function formatSummary(diff: ReturnType<typeof diffCommits>): string {
  const parts: string[] = [];
  
  if (diff.added_roles.length) parts.push(`+ ${diff.added_roles.length} role(s)`);
  if (diff.removed_roles.length) parts.push(`- ${diff.removed_roles.length} role(s)`);
  if (diff.modified_roles.length) parts.push(`~ ${diff.modified_roles.length} role(s)`);
  if (diff.added_channels.length) parts.push(`+ ${diff.added_channels.length} channel(s)`);
  if (diff.removed_channels.length) parts.push(`- ${diff.removed_channels.length} channel(s)`);
  if (diff.modified_channels.length) parts.push(`~ ${diff.modified_channels.length} channel(s)`);
  
  return parts.join(' | ') || 'No changes';
}

function formatDetails(diff: ReturnType<typeof diffCommits>): string {
  const lines: string[] = [];
  
  for (const r of diff.added_roles) lines.push(`\`+\` role: ${r.item.name}`);
  for (const r of diff.removed_roles) lines.push(`\`-\` role: ${r.item.name}`);
  for (const r of diff.modified_roles) {
    const changes = getRoleChanges(r.previous!, r.item);
    if (changes.length) lines.push(`\`~\` role: ${r.item.name} (${changes.join(', ')})`);
  }
  
  for (const c of diff.added_channels) lines.push(`\`+\` channel: ${c.item.name} (${getChannelType(c.item.type)})`);
  for (const c of diff.removed_channels) lines.push(`\`-\` channel: ${c.item.name}`);
  for (const c of diff.modified_channels) {
    const changes = getChannelChanges(c.previous!, c.item);
    if (changes.length) lines.push(`\`~\` channel: ${c.item.name} (${changes.join(', ')})`);
  }
  
  if (lines.length === 0) return '';
  
  // Limit to 15 lines to avoid embed limits
  const displayLines = lines.slice(0, 15);
  const suffix = lines.length > 15 ? `\n...and ${lines.length - 15} more` : '';
  
  return `\`\`\`diff\n${displayLines.join('\n')}${suffix}\n\`\`\``;
}

function getRoleChanges(prev: RoleSnapshot, curr: RoleSnapshot): string[] {
  const changes: string[] = [];
  if (prev.name !== curr.name) changes.push(`name: ${prev.name} → ${curr.name}`);
  if (prev.color !== curr.color) changes.push(`color: #${prev.color.toString(16).padStart(6, '0')} → #${curr.color.toString(16).padStart(6, '0')}`);
  if (prev.hoist !== curr.hoist) changes.push(`hoist: ${prev.hoist} → ${curr.hoist}`);
  if (prev.mentionable !== curr.mentionable) changes.push(`mentionable: ${prev.mentionable} → ${curr.mentionable}`);
  if (prev.position !== curr.position) changes.push(`position: ${prev.position} → ${curr.position}`);
  
  const prevPerms = new Set(prev.permissions || []);
  const currPerms = new Set(curr.permissions || []);
  const added = [...currPerms].filter(p => !prevPerms.has(p));
  const removed = [...prevPerms].filter(p => !currPerms.has(p));
  if (added.length) changes.push(`perms +${added.join(',')}`);
  if (removed.length) changes.push(`perms -${removed.join(',')}`);
  
  return changes;
}

function getChannelChanges(prev: ChannelSnapshot, curr: ChannelSnapshot): string[] {
  const changes: string[] = [];
  if (prev.name !== curr.name) changes.push(`name: ${prev.name} → ${curr.name}`);
  if (prev.type !== curr.type) changes.push(`type: ${getChannelType(prev.type)} → ${getChannelType(curr.type)}`);
  if (prev.topic !== curr.topic) changes.push(`topic: ${prev.topic || 'none'} → ${curr.topic || 'none'}`);
  if (prev.nsfw !== curr.nsfw) changes.push(`nsfw: ${prev.nsfw} → ${curr.nsfw}`);
  if (prev.bitrate !== curr.bitrate) changes.push(`bitrate: ${prev.bitrate} → ${curr.bitrate}`);
  if (prev.user_limit !== curr.user_limit) changes.push(`user_limit: ${prev.user_limit} → ${curr.user_limit}`);
  if (prev.rate_limit_per_user !== curr.rate_limit_per_user) changes.push(`slowmode: ${prev.rate_limit_per_user}s → ${curr.rate_limit_per_user}s`);
  if (prev.position !== curr.position) changes.push(`position: ${prev.position} → ${curr.position}`);
  if (prev.parent_id !== curr.parent_id) changes.push(`parent: ${prev.parent_id || 'none'} → ${curr.parent_id || 'none'}`);
  
  const prevOw = new Map((prev.permission_overwrites || []).map(o => [o.id, o]));
  const currOw = new Map((curr.permission_overwrites || []).map(o => [o.id, o]));
  
  for (const [id, ow] of currOw) {
    if (!prevOw.has(id)) {
      changes.push(`overwrite +${id} (allow: ${ow.allow.join(',')}, deny: ${ow.deny.join(',')})`);
    } else {
      const p = prevOw.get(id)!;
      if (p.allow.join(',') !== ow.allow.join(',') || p.deny.join(',') !== ow.deny.join(',')) {
        changes.push(`overwrite ~${id}`);
      }
    }
  }
  for (const id of prevOw.keys()) {
    if (!currOw.has(id)) changes.push(`overwrite -${id}`);
  }
  
  return changes;
}

function getChannelType(type: number): string {
  const types: Record<number, string> = {
    0: 'text', 1: 'dm', 2: 'voice', 3: 'group_dm', 4: 'category', 5: 'announcement', 10: 'announcement_thread',
    11: 'public_thread', 12: 'private_thread', 13: 'stage_voice', 14: 'directory', 15: 'forum', 16: 'media'
  };
  return types[type] || `unknown(${type})`;
}