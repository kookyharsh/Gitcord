import { Client, EmbedBuilder, ChannelType } from 'discord.js';
import { getConfig } from '../storage/config.js';

export async function logToChannel(
  client: Client,
  server_id: string,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const config = await getConfig(server_id);
    if (!config.log_channel_id) return;

    const channel = client.channels.cache.get(config.log_channel_id);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) return;

    await channel.send({ embeds: [embed] });
  } catch {
    // Silently ignore — log channel is best-effort
  }
}
