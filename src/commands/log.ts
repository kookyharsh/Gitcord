import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { listCommits, countCommits } from '../storage/commits.js';

export async function handleLog(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const server_id = interaction.guildId!;
  const limit = Math.min(interaction.options.getInteger('limit') ?? 10, 50);

  const total = await countCommits(server_id);
  const commits = await listCommits(server_id, limit, 0);

  if (commits.length === 0) {
    await interaction.editReply({ content: 'No commits yet.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Commit Log')
    .setColor(0x5865F2)
    .setFooter({ text: `Page 1 · ${total} total commits` });

  for (const c of commits) {
    const shortId = c.commit_id.slice(0, 12);
    const date = new Date(c.timestamp).toLocaleString();
    embed.addFields({
      name: `${shortId} — ${c.message}`,
      value: `by ${c.author_tag} · ${c.meta.channel_count}📁 ${c.meta.role_count}👤 · ${date}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
