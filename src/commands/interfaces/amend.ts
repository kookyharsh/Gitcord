import { ChatInputCommandInteraction } from 'discord.js';

export interface AmendCommandOptions {
  message: string;
}

export interface AmendDiffChange {
  type: 'added' | 'removed' | 'modified';
  entityType: 'role' | 'channel';
  name: string;
}

export interface AmendCommandResult {
  newCommitId: string;
  previousCommitId: string;
  message: string;
  changes: AmendDiffChange[];
  channelCount: number;
  roleCount: number;
}