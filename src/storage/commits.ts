import { Collection, Db, WithId } from 'mongodb';
import { Commit } from '../types/index.js';

let col: Collection<Commit>;

export function initCommits(db: Db): void {
  col = db.collection<Commit>('commits');
}

export async function insertCommit(commit: Commit): Promise<void> {
  await col.insertOne(commit);
}

export async function findCommit(commit_id: string): Promise<Commit | null> {
  if (commit_id.length === 64 && /^[a-f0-9]+$/.test(commit_id)) {
    return col.findOne({ commit_id });
  }
  return findCommitByPrefix(commit_id);
}

async function findCommitByPrefix(prefix: string): Promise<Commit | null> {
  const regex = new RegExp(`^${prefix}`);
  return col.findOne({ commit_id: { $regex: regex } });
}

export async function listCommits(
  server_id: string,
  limit: number,
  skip: number,
): Promise<WithId<Commit>[]> {
  return col
    .find({ server_id })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

export async function countCommits(server_id: string): Promise<number> {
  return col.countDocuments({ server_id });
}

export async function findCommitsOlderThan(
  server_id: string,
  timestamp: string,
): Promise<WithId<Commit>[]> {
  return col.find({ server_id, timestamp: { $lt: timestamp } }).toArray();
}

export async function deleteCommits(commit_ids: string[]): Promise<number> {
  const result = await col.deleteMany({ commit_id: { $in: commit_ids } });
  return result.deletedCount;
}
