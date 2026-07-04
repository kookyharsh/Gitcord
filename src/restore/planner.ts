import { ChannelSnapshot, RestorePlan, RoleSnapshot } from '../types/index.js';
import { diffCommits } from '../diff/index.js';
import { filterProtected } from './safety.js';

export function buildRestorePlan(
  targetRoles: RoleSnapshot[],
  targetChannels: ChannelSnapshot[],
  currentRoles: RoleSnapshot[],
  currentChannels: ChannelSnapshot[],
  protectedRoleIds: string[],
  protectedChannelIds: string[],
): RestorePlan {
  const diff = diffCommits(currentRoles, currentChannels, targetRoles, targetChannels);

  const createRoles = diff.added_roles.map(r => r.item);
  const updateRoles = diff.modified_roles.map(r => r.item);
  const deleteChannels = diff.removed_channels.map(c => ({ type: 'channel' as const, id: c.item.id }));
  const deleteRoles = diff.removed_roles.map(r => ({ type: 'role' as const, id: r.item.id }));

  const safeDeleteChannels = filterProtected(deleteChannels, protectedChannelIds);
  const safeDeleteRoles = filterProtected(deleteRoles, protectedRoleIds);

  const createChannels = diff.added_channels.map(c => c.item);
  const updateChannels = diff.modified_channels.map(c => c.item);

  const reorderChannels = [...targetChannels]
    .sort((a, b) => {
      if (a.parent_id !== b.parent_id) return (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
      return a.position - b.position;
    })
    .map(c => ({ id: c.id, position: c.position }));

  return {
    commit_id: '',
    server_id: '',
    create_roles: createRoles,
    update_roles: updateRoles,
    create_channels: createChannels,
    update_channels: updateChannels,
    reorder_channels: reorderChannels,
    delete_ids: [...safeDeleteChannels, ...safeDeleteRoles] as { type: 'channel' | 'role'; id: string }[],
  };
}
