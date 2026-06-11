import { run as jscodeshiftRun } from 'jscodeshift/src/Runner.js';
import { join } from 'path';

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

  const result = await jscodeshiftRun(transformPath, [options.targetPath], {
    dry: options.dry,
    extensions: options.extensions.join(','),
    parser: 'tsx',
    ignorePattern: ['**/node_modules/**', '**/dist/**'],
    verbose: 0,
    runInBand: false,
  }) as { ok: number; error: number; nochange: number };

  return {
    processed: (result.ok ?? 0) + (result.nochange ?? 0) + (result.error ?? 0),
    changed: result.ok ?? 0,
    errors: result.error ?? 0,
  };
}
