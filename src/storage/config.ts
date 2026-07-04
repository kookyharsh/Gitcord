import { Db } from 'mongodb';
import { GuildConfig } from '../types/index.js';

let col: import('mongodb').Collection<GuildConfig>;

export function initConfig(db: Db): void {
  col = db.collection<GuildConfig>('guild_configs');
}

const DEFAULTS: Omit<GuildConfig, 'server_id'> = {
  head_commit_id: null,
  log_channel_id: null,
  protected_role_ids: [],
  protected_channel_ids: [],
  role_whitelist: [],
  retention_days: 90,
  rollback_cooldown_seconds: 30,
  ignored_channel_ids: [],
  ignored_role_ids: [],
  ignored_category_ids: [],
  ignored_channel_types: [],
};

export async function getConfig(server_id: string): Promise<GuildConfig> {
  const config = await col.findOne({ server_id });
  if (config) {
    return { ...DEFAULTS, ...config } as GuildConfig;
  }
  const created = { server_id, ...DEFAULTS };
  await col.insertOne(created);
  return created;
}

export async function updateConfig(
  server_id: string,
  update: Partial<Omit<GuildConfig, 'server_id'>>,
): Promise<void> {
  await col.updateOne({ server_id }, { $set: update }, { upsert: true });
}
