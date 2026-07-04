import { Collection } from 'discord.js';
import { Command } from './command.interface.js';

import * as status from './cmd/status.js';
import * as commit from './cmd/commit.js';
import * as log from './cmd/log.js';
import * as diff from './cmd/diff.js';
import * as preview from './cmd/preview.js';
import * as rollback from './cmd/rollback.js';
import * as logsetup from './cmd/logsetup.js';
import * as gitignore from './cmd/gitignore.js';
import * as amend from './cmd/amend.js';

export const commands = new Collection<string, Command>();

const commandList: Command[] = [
  status as Command,
  commit as Command,
  log as Command,
  diff as Command,
  preview as Command,
  rollback as Command,
  logsetup as Command,
  gitignore as Command,
  amend as Command,
];

for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}
