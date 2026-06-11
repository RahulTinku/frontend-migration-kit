import { Command } from 'commander';
import { listCodemods } from '../codemods/registry.js';

export function listCommand(): Command {
  return new Command('list')
    .description('List all available codemods')
    .action(() => {
      const codemods = listCodemods();

      console.log('\nAvailable codemods:\n');

      for (const codemod of codemods) {
        const tags = codemod.tags.map((t) => `[${t}]`).join(' ');
        console.log(`  ${codemod.name.padEnd(30)} ${codemod.description}`);
        console.log(`  ${' '.repeat(30)} ${tags}\n`);
      }

      console.log(`Total: ${codemods.length} codemods\n`);
    });
}
