import { Db } from 'mongodb';
import { AuditLogEntry } from '../types/index.js';

let col: import('mongodb').Collection<AuditLogEntry>;

export function initAudit(db: Db): void {
  col = db.collection<AuditLogEntry>('audit_logs');
}

export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  await col.insertOne(entry);
}

export async function listAuditLogs(
  server_id: string,
  limit: number,
): Promise<AuditLogEntry[]> {
  return col.find({ server_id }).sort({ timestamp: -1 }).limit(limit).toArray();
}
