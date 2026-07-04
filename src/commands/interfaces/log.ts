import { ChatInputCommandInteraction } from 'discord.js';

export interface LogCommandOptions {
  limit?: number;
}

export interface LogCommitEntry {
  commitId: string;
  message: string;
  authorTag: string;
  timestamp: string;
  channelCount: number;
  roleCount: number;
}

export interface LogCommandResult {
  commits: LogCommitEntry[];
  totalCount: number;
}