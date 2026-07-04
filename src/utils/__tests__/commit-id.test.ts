import { describe, it, expect } from 'vitest';
import { computeCommitId, canonicalJson } from '../commit-id.js';
import { ChannelSnapshot, RoleSnapshot } from '../../types/index.js';

describe('canonicalJson', () => {
  it('sorts keys alphabetically', () => {
    const result = canonicalJson({ b: 2, a: 1 });
    expect(result).toBe('{"a":1,"b":2}');
  });
});

describe('computeCommitId', () => {
  const channels: ChannelSnapshot[] = [];
  const roles: RoleSnapshot[] = [];

  it('produces a 64-char hex string', () => {
    const id = computeCommitId('guild1', [], 'user1', 'user#1234', 'first commit', channels, roles);
    expect(id).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(id)).toBe(true);
  });

  it('produces the same ID for identical inputs', () => {
    const a = computeCommitId('guild1', [], 'user1', 'user#1234', 'msg', channels, roles);
    const b = computeCommitId('guild1', [], 'user1', 'user#1234', 'msg', channels, roles);
    expect(a).toBe(b);
  });

  it('produces different IDs for different messages', () => {
    const a = computeCommitId('guild1', [], 'user1', 'user#1234', 'msg1', channels, roles);
    const b = computeCommitId('guild1', [], 'user1', 'user#1234', 'msg2', channels, roles);
    expect(a).not.toBe(b);
  });
});
