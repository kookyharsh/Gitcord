import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { connect, disconnect } from './storage/mongo.js';
import { initStorage } from './storage/index.js';
import { startRollbackWorker } from './jobs/rollback.js';
import { commands } from './commands/index.js';
import { debouncedUpdateStickyStatus, updateStickyStatus } from './jobs/live-status.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('DISCORD_TOKEN is required');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const commandDataList = commands.map(c => c.data.toJSON());

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const db = await connect();
  initStorage(db);
  startRollbackWorker(client);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commandDataList });
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Failed to register commands', err);
  }

  // Initial sticky message setup for all guilds
  for (const guild of client.guilds.cache.values()) {
    updateStickyStatus(client, guild.id).catch(console.error);
  }
});

const triggerStickyUpdate = (item: any) => {
  const guildId = item?.guild?.id || item?.guildId;
  if (guildId) debouncedUpdateStickyStatus(client, guildId);
};

client.on('channelCreate', triggerStickyUpdate);
client.on('channelUpdate', (_, newChannel) => triggerStickyUpdate(newChannel));
client.on('channelDelete', triggerStickyUpdate);
client.on('roleCreate', triggerStickyUpdate);
client.on('roleUpdate', (_, newRole) => triggerStickyUpdate(newRole));
client.on('roleDelete', triggerStickyUpdate);

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const reply = { content: 'There was an error while executing this command!', flags: 1 << 6 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
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
