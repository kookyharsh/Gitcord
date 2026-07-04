import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { connect, disconnect } from './storage/mongo.js';
import { initStorage } from './storage/index.js';
import { handleStatus } from './commands/status.js';
import { handleCommit } from './commands/commit.js';
import { handleLog } from './commands/log.js';
import { handleDiff } from './commands/diff.js';
import { handlePreview } from './commands/preview.js';
import { handleRollback } from './commands/rollback.js';
import { startRollbackWorker } from './jobs/rollback.js';
import { handlePrune } from './commands/prune.js';
import { handleLogsetup } from './commands/logsetup.js';
import { handleGitignore } from './commands/gitignore.js';
import { handleCommitSearch } from './autocomplete/commit-search.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('DISCORD_TOKEN is required');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show current branch and head commit info'),
  new SlashCommandBuilder()
    .setName('commit')
    .setDescription('Snapshot the current guild state')
    .addStringOption(o => o.setName('message').setDescription('Commit message').setRequired(true)),
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Show commit history')
    .addIntegerOption(o => o.setName('limit').setDescription('Number of commits').setRequired(false)),
  new SlashCommandBuilder()
    .setName('diff')
    .setDescription('Show diff between two commits')
    .addStringOption(o => o.setName('commit_a').setDescription('First commit ID').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('commit_b').setDescription('Second commit ID').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('preview')
    .setDescription('Preview differences between a commit and live guild')
    .addStringOption(o => o.setName('commit_id').setDescription('Commit ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('rollback')
    .setDescription('Rollback guild state to a previous commit')
    .addStringOption(o => o.setName('commit_id').setDescription('Target commit ID').setRequired(true)),
  new SlashCommandBuilder()
    .setName('prune')
    .setDescription('Delete commits older than N days')
    .addIntegerOption(o => o.setName('days').setDescription('Age in days').setRequired(true)),
  new SlashCommandBuilder()
    .setName('logsetup')
    .setDescription('Auto-create a private channel for audit log messages'),
  new SlashCommandBuilder()
    .setName('gitignore')
    .setDescription('Manage items excluded from snapshots')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add an item to gitignore')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to ignore').setRequired(false))
      .addRoleOption(o => o.setName('role').setDescription('Role to ignore').setRequired(false))
      .addChannelOption(o => o.setName('category').setDescription('Category to ignore').setRequired(false))
      .addStringOption(o => o.setName('type').setDescription('Channel type to ignore').setRequired(false)
        .addChoices(
          { name: 'text', value: 'text' },
          { name: 'voice', value: 'voice' },
          { name: 'category', value: 'category' },
          { name: 'forum', value: 'forum' },
          { name: 'announcement', value: 'announcement' },
          { name: 'stage', value: 'stage' },
        )))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an item from gitignore')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to unignore').setRequired(false))
      .addRoleOption(o => o.setName('role').setDescription('Role to unignore').setRequired(false))
      .addChannelOption(o => o.setName('category').setDescription('Category to unignore').setRequired(false))
      .addStringOption(o => o.setName('type').setDescription('Channel type to unignore').setRequired(false)
        .addChoices(
          { name: 'text', value: 'text' },
          { name: 'voice', value: 'voice' },
          { name: 'category', value: 'category' },
          { name: 'forum', value: 'forum' },
          { name: 'announcement', value: 'announcement' },
          { name: 'stage', value: 'stage' },
        )))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show all ignored items'))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Remove all ignore rules')),
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const db = await connect();
  initStorage(db);
  startRollbackWorker(client);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Failed to register commands', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

  if (interaction.isChatInputCommand()) {
    switch (interaction.commandName) {
      case 'status':
        await handleStatus(interaction);
        break;
      case 'commit':
        await handleCommit(interaction);
        break;
      case 'log':
        await handleLog(interaction);
        break;
      case 'diff':
        await handleDiff(interaction);
        break;
      case 'preview':
        await handlePreview(interaction);
        break;
      case 'rollback':
        await handleRollback(interaction);
        break;
      case 'prune':
        await handlePrune(interaction);
        break;
      case 'logsetup':
        await handleLogsetup(interaction);
        break;
      case 'gitignore':
        await handleGitignore(interaction);
        break;
    }
  } else if (interaction.isAutocomplete()) {
    await handleCommitSearch(interaction);
  }
});

process.on('SIGINT', async () => {
  await disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnect();
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
