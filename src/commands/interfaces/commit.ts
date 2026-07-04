import { ChatInputCommandInteraction } from 'discord.js';

export interface CommitCommandOptions {
  message: string;
}

export interface CommitCommandResult {
  commitId: string;
  message: string;
  channelCount: number;
  roleCount: number;
}