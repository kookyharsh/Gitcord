import { describe, it, expect } from 'vitest';
import { diffCommits } from '../index.js';
import { RoleSnapshot, ChannelSnapshot } from '../../types/index.js';

const baseRole: RoleSnapshot = {
  id: '1', name: 'admin', color: 0xFF0000, hoist: true,
  position: 10, permissions: ['ManageGuild', 'KickMembers'], mentionable: false,
};

const baseChannel: ChannelSnapshot = {
  id: '10', type: 0, name: 'general', position: 0, parent_id: null,
  topic: null, nsfw: false, bitrate: null, user_limit: null,
  rate_limit_per_user: null, permission_overwrites: [],
};

describe('diffCommits', () => {
  it('returns empty diff for identical commits', () => {
    const result = diffCommits([baseRole], [baseChannel], [baseRole], [baseChannel]);
    expect(result.added_roles).toHaveLength(0);
    expect(result.removed_roles).toHaveLength(0);
    expect(result.modified_roles).toHaveLength(0);
    expect(result.added_channels).toHaveLength(0);
    expect(result.removed_channels).toHaveLength(0);
    expect(result.modified_channels).toHaveLength(0);
  });

  it('detects added roles', () => {
    const next = [baseRole, { ...baseRole, id: '2', name: 'mod' }];
    const result = diffCommits([baseRole], [baseChannel], next, [baseChannel]);
    expect(result.added_roles).toHaveLength(1);
    expect(result.added_roles[0].item.name).toBe('mod');
  });

  it('detects removed roles', () => {
    const next: RoleSnapshot[] = [];
    const result = diffCommits([baseRole], [baseChannel], next, [baseChannel]);
    expect(result.removed_roles).toHaveLength(1);
    expect(result.removed_roles[0].item.name).toBe('admin');
  });

  it('detects modified roles', () => {
    const modified = { ...baseRole, color: 0x0000FF };
    const result = diffCommits([baseRole], [baseChannel], [modified], [baseChannel]);
    expect(result.modified_roles).toHaveLength(1);
  });

  it('detects added channels', () => {
    const nextChan = { ...baseChannel, id: '11', name: 'new-channel' };
    const result = diffCommits([baseRole], [baseChannel], [baseRole], [baseChannel, nextChan]);
    expect(result.added_channels).toHaveLength(1);
    expect(result.added_channels[0].item.name).toBe('new-channel');
  });

  it('detects removed channels', () => {
    const result = diffCommits([baseRole], [baseChannel], [baseRole], []);
    expect(result.removed_channels).toHaveLength(1);
  });

  it('detects modified channels', () => {
    const modified = { ...baseChannel, name: 'renamed' };
    const result = diffCommits([baseRole], [baseChannel], [baseRole], [modified]);
    expect(result.modified_channels).toHaveLength(1);
  });
});
