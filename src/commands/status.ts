import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findCommit } from '../storage/commits.js';
import { getConfig } from '../storage/config.js';

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

  await interaction.reply({ embeds: [embed] });
}
