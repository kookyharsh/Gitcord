import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { getConfig, updateConfig } from '../storage/config.js';
import { snapshotGuild } from '../snapshotter/index.js';
import { findCommit } from '../storage/commits.js';
import { diffCommits } from '../diff/index.js';
import { formatSummary, formatDetails } from '../commands/cmd/status.js';

const timeouts = new Map<string, NodeJS.Timeout>();

export function debouncedUpdateStickyStatus(client: Client, guild_id: string) {
  if (timeouts.has(guild_id)) {
    clearTimeout(timeouts.get(guild_id));
  }
  const timeout = setTimeout(() => {
    updateStickyStatus(client, guild_id).catch(console.error);
    timeouts.delete(guild_id);
  }, 5000);
  timeouts.set(guild_id, timeout);
}

export async function updateStickyStatus(client: Client, guild_id: string) {
  const config = await getConfig(guild_id);
  if (!config.log_channel_id) return;

  const guild = client.guilds.cache.get(guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel;
  if (!channel) return;

  const live = await snapshotGuild(guild);
  let summary = 'No changes';
  let details = '';

  if (config.head_commit_id) {
    const head = await findCommit(config.head_commit_id);
    if (head) {
      const diff = diffCommits(head.roles, head.channels, live.roles, live.channels);
      summary = formatSummary(diff);
      details = formatDetails(diff);
    }
  } else {
      summary = `Current Guild State: ${live.channels.length} channels / ${live.roles.length} roles`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Current Changes')
    .setColor(0x5865F2)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: '', value: details });
  }

  if (config.status_message_id) {
    try {
      const oldMsg = await channel.messages.fetch(config.status_message_id);
      if (oldMsg) await oldMsg.delete();
    } catch (e) {
      // Ignored - message may have been manually deleted or is too old
    }
  }

  const newMsg = await channel.send({ embeds: [embed] });
  await updateConfig(guild_id, { status_message_id: newMsg.id });
}
