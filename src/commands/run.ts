import { Command } from 'commander';
import { runCodemod } from '../utils/runner.js';
import { findCodemod } from '../codemods/registry.js';

export function runCommand(): Command {
  return new Command('run')
    .description('Run a codemod against a file or directory')
    .argument('<codemod>', 'Name of the codemod to run (use "list" to see options)')
    .argument('<path>', 'File or directory to transform')
    .option('--dry', 'Preview changes without writing to disk', false)
    .option('--extensions <ext>', 'Comma-separated list of file extensions', 'js,jsx,ts,tsx')
    .action(async (codemodName: string, targetPath: string, options: { dry: boolean; extensions: string }) => {
      const meta = findCodemod(codemodName);

      if (!meta) {
        console.error(`\nUnknown codemod: "${codemodName}"`);
        console.error('Run "migrate list" to see available codemods.\n');
        process.exit(1);
      }

      console.log(`\nRunning: ${meta.name}`);
      console.log(`  ${meta.description}`);
      console.log(`  Path: ${targetPath}`);
      if (options.dry) console.log('  Mode: dry run (no files will be written)\n');
      else console.log();

      const extensions = options.extensions.split(',').map((e) => e.trim());

      const result = await runCodemod({
        name: codemodName,
        targetPath,
        dry: options.dry,
        extensions,
      });

      console.log(`\nDone.`);
      console.log(`  Files processed: ${result.processed}`);
      console.log(`  Files changed:   ${result.changed}`);
      console.log(`  Errors:          ${result.errors}\n`);
    });
}
