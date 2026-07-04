import { ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField, SlashCommandBuilder, RepliableInteraction } from 'discord.js';
import { snapshotGuild } from '../../snapshotter/index.js';
import { computeCommitId } from '../../utils/index.js';
import { insertCommit, findCommit } from '../../storage/commits.js';
import { getConfig, updateConfig } from '../../storage/config.js';
import { insertAuditLog } from '../../storage/audit.js';
import { logToChannel } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('commit')
  .setDescription('Snapshot the current guild state')
  .addStringOption(o => o.setName('message').setDescription('Commit message').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const message = interaction.options.getString('message', true);
  await performCommit(interaction, message);
}

export async function performCommit(interaction: RepliableInteraction, message: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!("memberPermissions" in interaction) || !(interaction.memberPermissions as Readonly<PermissionsBitField>)?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.editReply({ content: 'You need `MANAGE_GUILD` permission to commit.' });
    return;
  }

  const guild = interaction.guild!;
  const server_id = guild.id;

  const snapshot = await snapshotGuild(guild);
  const config = await getConfig(server_id);
  const parent_ids = config.head_commit_id ? [config.head_commit_id] : [];

  const commit_id = computeCommitId(
    server_id,
    parent_ids,
    interaction.user.id,
    interaction.user.tag,
    message,
    snapshot.channels,
    snapshot.roles,
  );

  const existing = await findCommit(commit_id);
  if (existing) {
    await interaction.editReply({ content: 'Identical state already committed — no changes detected.' });
    return;
  }

  const commit = {
    commit_id,
    server_id,
    parent_ids,
    author_id: interaction.user.id,
    author_tag: interaction.user.tag,
    timestamp: new Date().toISOString(),
    message,
    channels: snapshot.channels,
    roles: snapshot.roles,
    meta: {
      channel_count: snapshot.channels.length,
      role_count: snapshot.roles.length,
    },
  };

  await insertCommit(commit);
  await updateConfig(server_id, { head_commit_id: commit_id });

  await insertAuditLog({
    server_id,
    user_id: interaction.user.id,
    command: 'commit',
    commit_id,
    result: 'success',
    timestamp: new Date().toISOString(),
  });

  const embed = new EmbedBuilder()
    .setTitle('Commit Created')
    .setColor(0x2ECC71)
    .setDescription(`\`${commit_id.slice(0, 12)}\` — ${message}`)
    .addFields(
      { name: 'Channels', value: String(snapshot.channels.length), inline: true },
      { name: 'Roles', value: String(snapshot.roles.length), inline: true },
    )
    .setFooter({ text: `by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });

  await logToChannel(interaction.client, server_id,
    new EmbedBuilder()
      .setTitle('💾 Commit Created')
      .setColor(0x2ECC71)
      .setDescription(`\`${commit_id.slice(0, 12)}\` — ${message}`)
      .addFields(
        { name: 'Author', value: interaction.user.tag, inline: true },
        { name: 'Channels', value: String(snapshot.channels.length), inline: true },
        { name: 'Roles', value: String(snapshot.roles.length), inline: true },
      )
      .setTimestamp(),
  );
}
