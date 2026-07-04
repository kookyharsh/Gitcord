import { ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField, ChannelType } from 'discord.js';
import { updateConfig, getConfig } from '../../storage/config.js';

export async function handleLogsetup(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need `MANAGE_GUILD` permission to set up logging.', ephemeral: true });
    return;
  }

  const server_id = interaction.guildId!;
  const guild = interaction.guild!;

  const channel = await guild.channels.create({
    name: 'gitcord-logs',
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
    ],
    reason: 'Gitcord log channel',
  });

  const config = await getConfig(server_id);
  const ignored = config.ignored_channel_ids.includes(channel.id)
    ? config.ignored_channel_ids
    : [...config.ignored_channel_ids, channel.id];

  await updateConfig(server_id, { log_channel_id: channel.id, ignored_channel_ids: ignored });

  const embed = new EmbedBuilder()
    .setTitle('📝 Log Channel Created')
    .setColor(0x2ECC71)
    .setDescription(`All Gitcord events will be logged to ${channel}.`)
    .addFields(
      { name: 'Retention', value: `${config.retention_days} days`, inline: true },
      { name: 'Cooldown', value: `${config.rollback_cooldown_seconds}s`, inline: true },
      { name: 'Excluded', value: 'Log channel auto-added to gitignore', inline: false },
    );

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `Log channel created and excluded from snapshots: ${channel}`, ephemeral: true });
}
