export interface PermissionOverwriteSnapshot {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

export interface ChannelSnapshot {
  id: string;
  type: number;
  name: string;
  position: number;
  parent_id: string | null;
  topic: string | null;
  nsfw: boolean;
  bitrate: number | null;
  user_limit: number | null;
  rate_limit_per_user: number | null;
  permission_overwrites: PermissionOverwriteSnapshot[];
}

export interface RoleSnapshot {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string[];
  mentionable: boolean;
}

export interface CommitMeta {
  channel_count: number;
  role_count: number;
}

export interface Commit {
  commit_id: string;
  server_id: string;
  parent_ids: string[];
  author_id: string;
  author_tag: string;
  timestamp: string;
  message: string;
  channels: ChannelSnapshot[];
  roles: RoleSnapshot[];
  meta: CommitMeta;
}

export interface AuditLogEntry {
  server_id: string;
  user_id: string;
  command: string;
  commit_id?: string;
  result: 'success' | 'failure' | 'cancelled';
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface GuildConfig {
  server_id: string;
  head_commit_id: string | null;
  log_channel_id: string | null;
  protected_role_ids: string[];
  protected_channel_ids: string[];
  role_whitelist: string[];
  retention_days: number;
  rollback_cooldown_seconds: number;
  ignored_channel_ids: string[];
  ignored_role_ids: string[];
  ignored_category_ids: string[];
  ignored_channel_types: number[];
}

export type DiffKind = 'added' | 'removed' | 'modified' | 'renamed';

export interface DiffChange<T> {
  kind: DiffKind;
  item: T;
  previous?: T;
}

export interface DiffResult {
  added_roles: DiffChange<RoleSnapshot>[];
  removed_roles: DiffChange<RoleSnapshot>[];
  modified_roles: DiffChange<RoleSnapshot>[];
  added_channels: DiffChange<ChannelSnapshot>[];
  removed_channels: DiffChange<ChannelSnapshot>[];
  modified_channels: DiffChange<ChannelSnapshot>[];
}

export interface RestorePlan {
  commit_id: string;
  server_id: string;
  create_roles: RoleSnapshot[];
  update_roles: RoleSnapshot[];
  create_channels: ChannelSnapshot[];
  update_channels: ChannelSnapshot[];
  reorder_channels: { id: string; position: number }[];
  delete_ids: { type: 'channel' | 'role'; id: string }[];
}
