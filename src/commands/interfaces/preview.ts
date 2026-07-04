import { ChatInputCommandInteraction } from 'discord.js';

export interface PreviewCommandOptions {
  commit_id: string;
}

export interface PreviewDiffResult {
  commitId: string;
  changes: {
    roles: {
      toCreate: string[];
      toDelete: string[];
      toUpdate: string[];
    };
    channels: {
      toCreate: string[];
      toDelete: string[];
      toUpdate: string[];
    };
  };
  identical: boolean;
}