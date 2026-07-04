import { ChatInputCommandInteraction } from 'discord.js';

export interface RollbackCommandOptions {
  commit_id: string;
}

export interface RollbackPlan {
  createRoles: number;
  updateRoles: number;
  createChannels: number;
  updateChannels: number;
  reorderChannels: number;
  deleteIds: number;
}

export interface RollbackCommandResult {
  commitId: string;
  plan: RollbackPlan;
  totalOperations: number;
  confirmed: boolean;
}