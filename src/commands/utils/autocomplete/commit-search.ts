import { AutocompleteInteraction } from 'discord.js';
import { listCommits } from '../../../storage/commits.js';

export async function handleCommitSearch(interaction: AutocompleteInteraction): Promise<void> {
  const server_id = interaction.guildId!;
  const searchTerm = interaction.options.getFocused() || '';
  
  const commits = await listCommits(server_id, 20, 0);
  const results = commits
    .filter(c => 
      c.commit_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.message.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 25)
    .map(c => ({ name: `${c.commit_id.slice(0, 12)} — ${c.message}`, value: c.commit_id }));
  
  await interaction.respond(results);
}