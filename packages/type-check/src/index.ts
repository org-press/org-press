/**
 * @org-press/type-check
 *
 * Type-check TypeScript blocks in org files.
 *
 * This package provides the `orgp type-check` CLI command plugin.
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { typeCheckPlugin } from '@org-press/type-check';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [typeCheckPlugin],
 * };
 * ```
 */

// Plugin export
export { typeCheckPlugin } from "./plugin.js";

// Command export (for programmatic use)
export { runTypeCheck, parseTypeCheckArgs } from "./command.js";

// Type exports
export type { CollectedBlock, CollectOptions, TypeCheckOptions, TsConfig } from "./types.js";

// Constant exports
export { TYPECHECK_LANGUAGES } from "./types.js";

// Utility exports (for advanced use cases)
export { collectCodeBlocks, loadTsConfig } from "./utils.js";
