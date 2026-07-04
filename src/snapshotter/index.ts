import { Guild } from 'discord.js';
import { ChannelSnapshot, PermissionOverwriteSnapshot, RoleSnapshot } from '../types/index.js';
import { getConfig } from '../storage/config.js';

export async function snapshotGuild(guild: Guild): Promise<{
  channels: ChannelSnapshot[];
  roles: RoleSnapshot[];
}> {
  const server_id = guild.id;
  const config = await getConfig(server_id);

  const ignoredRoleSet = new Set(config.ignored_role_ids);
  const ignoredChannelSet = new Set(config.ignored_channel_ids);
  const ignoredCategorySet = new Set(config.ignored_category_ids);
  const ignoredTypeSet = new Set(config.ignored_channel_types);

  const [fetchedChannels, fetchedRoles] = await Promise.all([
    guild.channels.fetch(),
    guild.roles.fetch(),
  ]);

  const roleSnapshots = fetchedRoles
    .filter(r => r.name !== '@everyone' && !ignoredRoleSet.has(r.id))
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.toArray().map(p => String(p)),
      mentionable: r.mentionable,
    } satisfies RoleSnapshot))
    .sort((a, b) => b.position - a.position);

  const channelSnapshots = fetchedChannels
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .filter(c => !ignoredChannelSet.has(c.id)
      && !ignoredCategorySet.has(c.parentId ?? '')
      && !ignoredTypeSet.has(c.type))
    .map(c => {
      const overwrites: PermissionOverwriteSnapshot[] = [];
      for (const [, ow] of c.permissionOverwrites.cache) {
        overwrites.push({
          id: ow.id,
          type: ow.type === 0 ? 'role' : 'member',
          allow: ow.allow.toArray().map(p => String(p)),
          deny: ow.deny.toArray().map(p => String(p)),
        });
      }
      return {
        id: c.id,
        type: c.type,
        name: c.name,
        position: c.position,
        parent_id: c.parentId,
        topic: 'topic' in c ? (c.topic ?? null) : null,
        nsfw: 'nsfw' in c ? c.nsfw : false,
        bitrate: 'bitrate' in c ? c.bitrate : null,
        user_limit: 'userLimit' in c ? c.userLimit : null,
        rate_limit_per_user: 'rateLimitPerUser' in c ? c.rateLimitPerUser : null,
        permission_overwrites: overwrites,
      } satisfies ChannelSnapshot;
    });

  return { channels: channelSnapshots, roles: roleSnapshots };
}
