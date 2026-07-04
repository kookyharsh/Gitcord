import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';

export interface Command {
  data: {
    name: string;
    toJSON(): any;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}
