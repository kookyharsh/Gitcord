import { ChatInputCommandInteraction } from 'discord.js';

export interface LogSetupCommandOptions {
  // No options
}

export interface LogSetupCommandResult {
  channelId: string;
  channelName: string;
}