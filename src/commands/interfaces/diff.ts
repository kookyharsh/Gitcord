import { ChatInputCommandInteraction } from 'discord.js';

export interface DiffCommandOptions {
  commit_a: string;
  commit_b: string;
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  entityType: 'role' | 'channel';
  name: string;
  details?: string;
}

export interface DiffCommandResult {
  commitA: string;
  commitB: string;
  changes: DiffChange[];
  totalChanges: number;
}