import { describe, it, expect } from 'vitest';
import { buildRestorePlan } from '../planner.js';
import { RoleSnapshot, ChannelSnapshot } from '../../types/index.js';

const baseRole: RoleSnapshot = {
  id: '1', name: 'admin', color: 0xFF0000, hoist: true,
  position: 10, permissions: ['ManageGuild'], mentionable: false,
};

const baseChannel: ChannelSnapshot = {
  id: '10', type: 0, name: 'general', position: 0, parent_id: null,
  topic: null, nsfw: false, bitrate: null, user_limit: null,
  rate_limit_per_user: null, permission_overwrites: [],
};

describe('buildRestorePlan', () => {
  it('produces empty plan for identical state', () => {
    const plan = buildRestorePlan([baseRole], [baseChannel], [baseRole], [baseChannel], [], []);
    expect(plan.create_roles).toHaveLength(0);
    expect(plan.update_roles).toHaveLength(0);
    expect(plan.create_channels).toHaveLength(0);
    expect(plan.update_channels).toHaveLength(0);
    expect(plan.delete_ids).toHaveLength(0);
  });

  it('plans role creation for target-only roles', () => {
    const target = [baseRole, { ...baseRole, id: '2', name: 'mod' }];
    const plan = buildRestorePlan(target, [baseChannel], [baseRole], [baseChannel], [], []);
    expect(plan.create_roles).toHaveLength(1);
    expect(plan.create_roles[0].name).toBe('mod');
  });

  it('plans role deletion for current-only roles', () => {
    const current = [baseRole, { ...baseRole, id: '2', name: 'mod' }];
    const plan = buildRestorePlan([baseRole], [baseChannel], current, [baseChannel], [], []);
    expect(plan.delete_ids).toHaveLength(1);
    expect(plan.delete_ids[0].id).toBe('2');
  });

  it('respects protected role IDs', () => {
    const current = [baseRole, { ...baseRole, id: '2', name: 'mod' }];
    const plan = buildRestorePlan([baseRole], [baseChannel], current, [baseChannel], ['2'], []);
    expect(plan.delete_ids).toHaveLength(0);
  });

  it('respects protected channel IDs', () => {
    const current = [baseChannel, { ...baseChannel, id: '11', name: 'extra' }];
    const plan = buildRestorePlan([baseRole], [baseChannel], [baseRole], current, [], ['11']);
    expect(plan.delete_ids).toHaveLength(0);
  });

  it('plans channel creation for target-only channels', () => {
    const target = [baseChannel, { ...baseChannel, id: '11', name: 'new' }];
    const plan = buildRestorePlan([baseRole], target, [baseRole], [baseChannel], [], []);
    expect(plan.create_channels).toHaveLength(1);
  });

  it('reorders channels by parent then position', () => {
    const target = [
      { ...baseChannel, id: 'a', name: 'cat', type: 4, position: 0 },
      { ...baseChannel, id: 'b', name: 'child', parent_id: 'a', position: 0 },
    ];
    const plan = buildRestorePlan([baseRole], target, [baseRole], target, [], []);
    expect(plan.reorder_channels[0].id).toBe('a');
    expect(plan.reorder_channels[1].id).toBe('b');
  });
});
