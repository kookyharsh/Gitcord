import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  Channel,
  Role,
  SlashCommandBuilder,
} from 'discord.js';
import { getConfig, updateConfig } from '../../storage/config.js';
import { GuildConfig } from '../../types/index.js';
import { logToChannel } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
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
    .setDescription('Remove all ignore rules'));

const CHANNEL_TYPE_MAP: Record<string, number> = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  forum: ChannelType.GuildForum,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
};

const CHANNEL_TYPES_BY_NAME: Record<number, string> = {};
for (const [name, id] of Object.entries(CHANNEL_TYPE_MAP)) {
  CHANNEL_TYPES_BY_NAME[id] = name;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need `MANAGE_GUILD` permission.', ephemeral: true });
    return;
  }

  const server_id = interaction.guildId!;
  const sub = interaction.options.getSubcommand();
  const config = await getConfig(server_id);

  switch (sub) {
    case 'add':
      await handleAdd(interaction, config);
      break;
    case 'remove':
      await handleRemove(interaction, config);
      break;
    case 'list':
      await handleList(interaction, config);
      break;
    case 'clear':
      await handleClear(interaction, config);
      break;
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction, config: GuildConfig): Promise<void> {
  const update: Partial<GuildConfig> = {};
  const server_id = interaction.guildId!;

  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const category = interaction.options.getChannel('category');
  const type = interaction.options.getString('type');

  if (channel) {
    if (config.ignored_channel_ids.includes(channel.id)) {
      await interaction.reply({ content: `Channel ${channel} is already ignored.`, ephemeral: true });
      return;
    }
    update.ignored_channel_ids = [...config.ignored_channel_ids, channel.id];
  }

  if (role) {
    if (config.ignored_role_ids.includes(role.id)) {
      await interaction.reply({ content: `Role ${role} is already ignored.`, ephemeral: true });
      return;
    }
    update.ignored_role_ids = [...config.ignored_role_ids, role.id];
  }

  if (category) {
    if (config.ignored_category_ids.includes(category.id)) {
      await interaction.reply({ content: `Category ${category} is already ignored.`, ephemeral: true });
      return;
    }
    update.ignored_category_ids = [...config.ignored_category_ids, category.id];
  }

  if (type) {
    const typeId = CHANNEL_TYPE_MAP[type];
    if (config.ignored_channel_types.includes(typeId)) {
      await interaction.reply({ content: `Channel type \`${type}\` is already ignored.`, ephemeral: true });
      return;
    }
    update.ignored_channel_types = [...config.ignored_channel_types, typeId];
  }

  if (Object.keys(update).length === 0) {
    await interaction.reply({ content: 'Specify at least one item to ignore.', ephemeral: true });
    return;
  }

  await updateConfig(server_id, update);

  const embed = new EmbedBuilder()
    .setTitle('✅ Gitignore Updated')
    .setColor(0x2ECC71)
    .setDescription('Items added to ignore list. They will be excluded from future snapshots.');
  addIgnoredFields(embed, { ...config, ...update });

  await interaction.reply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('📋 Gitignore Updated')
      .setColor(0x2ECC71)
      .setDescription(`Items added by ${interaction.user.tag}`)
      .setTimestamp(),
  );
}

async function handleRemove(interaction: ChatInputCommandInteraction, config: GuildConfig): Promise<void> {
  const update: Partial<GuildConfig> = {};
  const server_id = interaction.guildId!;

  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const category = interaction.options.getChannel('category');
  const type = interaction.options.getString('type');

  if (channel) {
    update.ignored_channel_ids = config.ignored_channel_ids.filter(id => id !== channel.id);
  }

  if (role) {
    update.ignored_role_ids = config.ignored_role_ids.filter(id => id !== role.id);
  }

  if (category) {
    update.ignored_category_ids = config.ignored_category_ids.filter(id => id !== category.id);
  }

  if (type) {
    const typeId = CHANNEL_TYPE_MAP[type];
    update.ignored_channel_types = config.ignored_channel_types.filter(t => t !== typeId);
  }

  if (Object.keys(update).length === 0) {
    await interaction.reply({ content: 'Specify at least one item to remove.', ephemeral: true });
    return;
  }

  await updateConfig(server_id, update);

  const embed = new EmbedBuilder()
    .setTitle('✅ Gitignore Updated')
    .setColor(0x2ECC71)
    .setDescription('Items removed from ignore list.');
  addIgnoredFields(embed, { ...config, ...update });

  await interaction.reply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('📋 Gitignore Updated')
      .setColor(0x2ECC71)
      .setDescription(`Items removed by ${interaction.user.tag}`)
      .setTimestamp(),
  );
}

async function handleList(interaction: ChatInputCommandInteraction, config: GuildConfig): Promise<void> {
  const guild = interaction.guild!;

  const channelNames = config.ignored_channel_ids.map(id => guild.channels.cache.get(id)?.name ?? id);
  const roleNames = config.ignored_role_ids.map(id => guild.roles.cache.get(id)?.name ?? id);
  const categoryNames = config.ignored_category_ids.map(id => guild.channels.cache.get(id)?.name ?? id);
  const typeNames = config.ignored_channel_types.map(id => CHANNEL_TYPES_BY_NAME[id] ?? `type_${id}`);

  const embed = new EmbedBuilder()
    .setTitle('📋 Gitignore List')
    .setColor(0x5865F2);

  addIgnoredFields(embed, config);

  await interaction.reply({ embeds: [embed] });
}

async function handleClear(interaction: ChatInputCommandInteraction, config: GuildConfig): Promise<void> {
  const server_id = interaction.guildId!;

  await updateConfig(server_id, {
    ignored_channel_ids: [],
    ignored_role_ids: [],
    ignored_category_ids: [],
    ignored_channel_types: [],
  });

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Gitignore Cleared')
    .setColor(0xE67E22)
    .setDescription('All ignore rules have been removed.');

  await interaction.reply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('🗑️ Gitignore Cleared')
      .setColor(0xE67E22)
      .setDescription(`All rules cleared by ${interaction.user.tag}`)
      .setTimestamp(),
  );
}

function addIgnoredFields(embed: EmbedBuilder, config: GuildConfig): void {
  const parts: string[] = [];

  if (config.ignored_channel_ids.length > 0) {
    parts.push(`**Channels:** ${config.ignored_channel_ids.length}`);
  }
  if (config.ignored_role_ids.length > 0) {
    parts.push(`**Roles:** ${config.ignored_role_ids.length}`);
  }
  if (config.ignored_category_ids.length > 0) {
    parts.push(`**Categories:** ${config.ignored_category_ids.length}`);
  }
  if (config.ignored_channel_types.length > 0) {
    const names = config.ignored_channel_types.map(id => CHANNEL_TYPES_BY_NAME[id] ?? `type_${id}`);
    parts.push(`**Channel Types:** ${names.join(', ')}`);
  }

  if (parts.length === 0) {
    embed.setDescription('No items are currently ignored.');
  } else {
    embed.setDescription(parts.join('\n'));
  }
}
