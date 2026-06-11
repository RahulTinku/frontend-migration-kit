import { run as jscodeshift } from 'jscodeshift/src/Runner.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RunOptions {
  name: string;
  targetPath: string;
  dry: boolean;
  extensions: string[];
}

export interface RunResult {
  processed: number;
  changed: number;
  errors: number;
}

export async function runCodemod(options: RunOptions): Promise<RunResult> {
  const transformPath = join(
    __dirname,
    '..',
    'codemods',
    options.name,
    'transform.js',
  );

  const result = await jscodeshift(transformPath, [options.targetPath], {
    dry: options.dry,
    extensions: options.extensions.join(','),
    ignorePattern: ['**/node_modules/**', '**/dist/**'],
    verbose: 0,
    runInBand: false,
  });

  return {
    processed: result.stats?.total ?? 0,
    changed: result.stats?.ok ?? 0,
    errors: result.stats?.error ?? 0,
  };
}
