import { ChatInputCommandInteraction } from 'discord.js';
import { Channel, Role, ChannelType } from 'discord.js';

export type GitignoreSubcommand = 'add' | 'remove' | 'list' | 'clear';

export interface GitignoreAddOptions {
  channel?: Channel;
  role?: Role;
  category?: Channel;
  type?: string;
}

export interface GitignoreRemoveOptions {
  channel?: Channel;
  role?: Role;
  category?: Channel;
  type?: string;
}

export interface GitignoreListResult {
  channels: string[];
  roles: string[];
  categories: string[];
  types: string[];
}

export interface GitignoreCommandResult {
  subcommand: GitignoreSubcommand;
  items?: GitignoreListResult;
  message: string;
}