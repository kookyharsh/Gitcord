import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { listCommits, countCommits } from '../../storage/commits.js';

export const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Show commit history')
  .addIntegerOption(o => o.setName('limit').setDescription('Number of commits').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
      value: `by ${c.author_tag} at ${date}`,
      inline: false,
    });
    embed.addFields(
      { name: 'Channels', value: String(c.meta.channel_count), inline: true },
      { name: 'Roles', value: String(c.meta.role_count), inline: true },
    );
  }

  await interaction.editReply({ embeds: [embed] });
}