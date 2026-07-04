import { ChatInputCommandInteraction } from 'discord.js';

export interface PruneCommandOptions {
  days: number;
}

export interface PruneCommandResult {
  deletedCount: number;
  days: number;
  headCommitKept: string | null;
}