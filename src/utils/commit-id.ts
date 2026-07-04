import { createHash } from 'node:crypto';
import { ChannelSnapshot, RoleSnapshot } from '../types/index.js';

export function canonicalJson(data: unknown): string {
  return JSON.stringify(data, Object.keys(data as object).sort());
}

export function computeCommitId(
  server_id: string,
  parent_ids: string[],
  author_id: string,
  author_tag: string,
  message: string,
  channels: ChannelSnapshot[],
  roles: RoleSnapshot[],
): string {
  const payload = {
    server_id,
    parent_ids: [...parent_ids].sort(),
    author_id,
    author_tag,
    message,
    channels: channels.map(normalizeChannel),
    roles: roles.map(normalizeRole),
  };
  const json = canonicalJson(payload);
  return createHash('sha256').update(json).digest('hex');
}

function normalizeChannel(c: ChannelSnapshot): ChannelSnapshot {
  return {
    ...c,
    permission_overwrites: c.permission_overwrites.map(p => ({
      ...p,
      allow: [...p.allow].sort(),
      deny: [...p.deny].sort(),
    })),
  };
}

function normalizeRole(r: RoleSnapshot): RoleSnapshot {
  return {
    ...r,
    permissions: [...r.permissions].sort(),
  };
}
