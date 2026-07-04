import { ChannelSnapshot, DiffResult, RoleSnapshot } from '../types/index.js';

export function diffCommits(
  prevRoles: RoleSnapshot[],
  prevChannels: ChannelSnapshot[],
  nextRoles: RoleSnapshot[],
  nextChannels: ChannelSnapshot[],
): DiffResult {
  const prevRoleMap = new Map(prevRoles.map(r => [r.id, r]));
  const nextRoleMap = new Map(nextRoles.map(r => [r.id, r]));

  const addedRoles: DiffResult['added_roles'] = [];
  const removedRoles: DiffResult['removed_roles'] = [];
  const modifiedRoles: DiffResult['modified_roles'] = [];

  for (const nr of nextRoles) {
    const pr = prevRoleMap.get(nr.id);
    if (!pr) {
      addedRoles.push({ kind: 'added', item: nr });
    } else if (roleChanged(pr, nr)) {
      modifiedRoles.push({ kind: 'modified', item: nr, previous: pr });
    }
  }
  for (const pr of prevRoles) {
    if (!nextRoleMap.has(pr.id)) {
      removedRoles.push({ kind: 'removed', item: pr });
    }
  }

  const prevChanMap = new Map(prevChannels.map(c => [c.id, c]));
  const nextChanMap = new Map(nextChannels.map(c => [c.id, c]));

  const addedChannels: DiffResult['added_channels'] = [];
  const removedChannels: DiffResult['removed_channels'] = [];
  const modifiedChannels: DiffResult['modified_channels'] = [];

  for (const nc of nextChannels) {
    const pc = prevChanMap.get(nc.id);
    if (!pc) {
      addedChannels.push({ kind: 'added', item: nc });
    } else if (channelChanged(pc, nc)) {
      modifiedChannels.push({ kind: 'modified', item: nc, previous: pc });
    }
  }
  for (const pc of prevChannels) {
    if (!nextChanMap.has(pc.id)) {
      removedChannels.push({ kind: 'removed', item: pc });
    }
  }

  return {
    added_roles: addedRoles,
    removed_roles: removedRoles,
    modified_roles: modifiedRoles,
    added_channels: addedChannels,
    removed_channels: removedChannels,
    modified_channels: modifiedChannels,
  };
}

function roleChanged(a: RoleSnapshot, b: RoleSnapshot): boolean {
  return (
    a.name !== b.name ||
    a.color !== b.color ||
    a.hoist !== b.hoist ||
    a.position !== b.position ||
    a.mentionable !== b.mentionable ||
    !arraysEqual(a.permissions, b.permissions)
  );
}

function channelChanged(a: ChannelSnapshot, b: ChannelSnapshot): boolean {
  return (
    a.name !== b.name ||
    a.type !== b.type ||
    a.position !== b.position ||
    a.parent_id !== b.parent_id ||
    a.topic !== b.topic ||
    a.nsfw !== b.nsfw ||
    a.bitrate !== b.bitrate ||
    a.user_limit !== b.user_limit ||
    a.rate_limit_per_user !== b.rate_limit_per_user ||
    !arraysEqual(
      a.permission_overwrites.map(p => `${p.id}:${p.type}:${p.allow.join(',')}:${p.deny.join(',')}`),
      b.permission_overwrites.map(p => `${p.id}:${p.type}:${p.allow.join(',')}:${p.deny.join(',')}`),
    )
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
