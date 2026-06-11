/**
 * frontend-migration-kit
 * Programmatic API for running codemods.
 */

export { runCodemod, type RunOptions } from './utils/runner.js';
export { listCodemods, type CodemodMeta } from './codemods/registry.js';
