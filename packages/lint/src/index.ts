/**
 * @org-press/lint
 *
 * Lint code blocks in org files using ESLint.
 *
 * This package provides the `orgp lint` CLI command plugin.
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { lintPlugin } from '@org-press/lint';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [lintPlugin],
 * };
 * ```
 */

// Plugin export
export { lintPlugin } from "./plugin.js";

// Command export (for programmatic use)
export { runLint, parseLintArgs } from "./command.js";

// Type exports
export type { CollectedBlock, CollectOptions, LintOptions } from "./types.js";

// Constant exports
export { LANGUAGE_EXTENSIONS, LINT_LANGUAGES } from "./types.js";

// Utility exports (for advanced use cases)
export { collectCodeBlocks, writeBlockContentBatch, findEslintConfig } from "./utils.js";
