import { Db } from 'mongodb';
import { initCommits } from './commits.js';
import { initAudit } from './audit.js';
import { initConfig } from './config.js';

export function initStorage(db: Db): void {
  initCommits(db);
  initAudit(db);
  initConfig(db);
}

export * from './commits.js';
export * from './audit.js';
export * from './config.js';
