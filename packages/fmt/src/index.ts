/**
 * @org-press/fmt
 *
 * Format code blocks in org files using Prettier.
 *
 * This package provides the `orgp fmt` CLI command plugin.
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { fmtPlugin } from '@org-press/fmt';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [fmtPlugin],
 * };
 * ```
 */

// Plugin export
export { fmtPlugin } from "./plugin.js";

// Command export (for programmatic use)
export { runFmt, parseFmtArgs } from "./command.js";

// Type exports
export type { CollectedBlock, CollectOptions, FmtOptions } from "./types.js";

// Constant exports
export { PRETTIER_PARSERS } from "./types.js";

// Utility exports (for advanced use cases)
export { collectCodeBlocks, writeBlockContentBatch, loadPrettierConfig } from "./utils.js";
