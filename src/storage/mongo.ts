import { MongoClient, Db } from 'mongodb';

const MONGODB_URI: string = process.env.MONGODB_URI ?? (() => { throw new Error('MONGODB_URI environment variable is required'); })();

const DB_NAME = 'gitcord';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connect(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  await ensureCollections(db);
  return db;
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

async function ensureCollections(db: Db): Promise<void> {
  const existing = await db.listCollections().toArray();
  const names = new Set(existing.map(c => c.name));

  const required = ['commits', 'audit_logs', 'guild_configs'];
  for (const name of required) {
    if (!names.has(name)) {
      await db.createCollection(name);
    }
  }

  await db.collection('audit_logs').createIndexes([
    { key: { server_id: 1, timestamp: -1 }, name: 'audit_server_ts' },
  ]);

  await db.collection('guild_configs').createIndexes([
    { key: { server_id: 1 }, unique: true, name: 'guild_configs_server' },
  ]);

  // Drop commits indexes if they exist with a different spec
  const idxInfo = await db.collection('commits').indexes();
  for (const idx of idxInfo) {
    if (idx.name === 'commits_server_ts') {
      if (JSON.stringify(idx.key) !== JSON.stringify({ server_id: 1, timestamp: -1 })) {
        await db.collection('commits').dropIndex('commits_server_ts');
      }
    }
    if (idx.name === 'commits_commit_id') {
      if (JSON.stringify(idx.key) !== JSON.stringify({ commit_id: 1 })) {
        await db.collection('commits').dropIndex('commits_commit_id');
      }
    }
  }

  await db.collection('commits').createIndexes([
    { key: { server_id: 1, timestamp: -1 }, name: 'commits_server_ts' },
    { key: { commit_id: 1 }, unique: true, name: 'commits_commit_id' },
  ]);
}
