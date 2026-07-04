import { ChatInputCommandInteraction } from 'discord.js';

export interface StatusCommandResult {
  headCommit: string | null;
  retentionDays: number;
  lastSnapshot: {
    message: string;
    author: string;
    timestamp: string;
    channels: number;
    roles: number;
  } | null;
  stagedChanges: {
    rolesAdded: number;
    rolesRemoved: number;
    rolesModified: number;
    channelsAdded: number;
    channelsRemoved: number;
    channelsModified: number;
  };
}