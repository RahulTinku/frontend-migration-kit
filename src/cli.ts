#!/usr/bin/env node

import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('migrate')
  .description('A curated toolkit of production-tested codemods for common frontend migrations')
  .version('0.1.0');

program.addCommand(listCommand());
program.addCommand(runCommand());

program.parse(process.argv);
