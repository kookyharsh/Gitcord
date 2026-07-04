import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { findCommit } from '../../storage/commits.js';
import { diffCommits } from '../../diff/index.js';
import { PermissionOverwriteSnapshot, ChannelSnapshot, RoleSnapshot } from '../../types/index.js';

const CHANGES_PER_PAGE = 15;

function formatChanges(diff: ReturnType<typeof diffCommits>, page: number): { content: string; totalPages: number } {
  const allChanges: string[] = [];
  
  for (const r of diff.added_roles) allChanges.push(`+ role: ${r.item.name}`);
  for (const r of diff.removed_roles) allChanges.push(`- role: ${r.item.name}`);
  for (const r of diff.modified_roles) {
    const changes = getRoleChanges(r.previous!, r.item);
    if (changes.length > 0) allChanges.push(`~ role: ${r.item.name} (${changes.join(', ')})`);
  }
  
  for (const c of diff.added_channels) allChanges.push(`+ channel: ${c.item.name} (${getChannelType(c.item.type)})`);
  for (const c of diff.removed_channels) allChanges.push(`- channel: ${c.item.name}`);
  for (const c of diff.modified_channels) {
    const changes = getChannelChanges(c.previous!, c.item);
    if (changes.length > 0) allChanges.push(`~ channel: ${c.item.name} (${changes.join(', ')})`);
  }
  
  const totalPages = Math.ceil(allChanges.length / CHANGES_PER_PAGE) || 1;
  const start = page * CHANGES_PER_PAGE;
  const end = start + CHANGES_PER_PAGE;
  const pageChanges = allChanges.slice(start, end);
  
  if (pageChanges.length === 0) {
    return { content: '```diff\nNo differences found.\n```', totalPages: 1 };
  }
  
  const header = `Page ${page + 1}/${totalPages} — ${allChanges.length} total changes`;
  const content = `\`\`\`diff\n${header}\n${pageChanges.join('\n')}\n\`\`\``;
  
  return { content, totalPages };
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
  const addedPerms = [...currPerms].filter(p => !prevPerms.has(p));
  const removedPerms = [...prevPerms].filter(p => !currPerms.has(p));
  
  if (addedPerms.length > 0) changes.push(`perms added: ${addedPerms.join(', ')}`);
  if (removedPerms.length > 0) changes.push(`perms removed: ${removedPerms.join(', ')}`);
  
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
  
  const prevOverwrites = new Map((prev.permission_overwrites || []).map((o: PermissionOverwriteSnapshot) => [o.id, o]));
  const currOverwrites = new Map((curr.permission_overwrites || []).map((o: PermissionOverwriteSnapshot) => [o.id, o]));
  
  for (const [id, overwrite] of currOverwrites) {
    if (!prevOverwrites.has(id)) {
      changes.push(`overwrite added: ${id} (allow: ${overwrite.allow.join(',')}, deny: ${overwrite.deny.join(',')})`);
    } else {
      const prevOw = prevOverwrites.get(id)!;
      if (prevOw.allow.join(',') !== overwrite.allow.join(',') || prevOw.deny.join(',') !== overwrite.deny.join(',')) {
        changes.push(`overwrite changed: ${id}`);
      }
    }
  }
  for (const id of prevOverwrites.keys()) {
    if (!currOverwrites.has(id)) {
      changes.push(`overwrite removed: ${id}`);
    }
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
  
  let currentPage = 0;
  const { content, totalPages } = formatChanges(diff, currentPage);
  
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('diff_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('diff_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
  );

  const reply = await interaction.editReply({
    content,
    components: totalPages > 1 ? [row] : [],
  });

  if (totalPages <= 1) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000,
    filter: i => i.user.id === interaction.user.id,
  });

  collector.on('collect', async i => {
    if (i.customId === 'diff_prev') currentPage = Math.max(0, currentPage - 1);
    else if (i.customId === 'diff_next') currentPage = Math.min(totalPages - 1, currentPage + 1);

    const { content: newContent } = formatChanges(diff, currentPage);
    const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('diff_prev')
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('diff_next')
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages - 1),
    );

    await i.update({ content: newContent, components: [newRow] });
  });

  collector.on('end', async () => {
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('diff_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('diff_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
    );
    try { await interaction.editReply({ components: [disabledRow] }); } catch {}
  });
}