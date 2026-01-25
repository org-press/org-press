/**
 * @org-press/tools
 *
 * Code quality tools for org-press - format, lint, and type-check code blocks.
 *
 * This package provides three BlockPlugin instances that register CLI commands:
 * - fmtPlugin → `orgp fmt` - Format code blocks with Prettier
 * - lintPlugin → `orgp lint` - Lint code blocks with ESLint
 * - typeCheckPlugin → `orgp type-check` - Type-check TypeScript blocks
 *
 * @example
 * ```typescript
 * // .org-press/config.ts
 * import { fmtPlugin, lintPlugin, typeCheckPlugin } from '@org-press/tools';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [fmtPlugin, lintPlugin, typeCheckPlugin],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Or import all plugins at once
 * import { allPlugins } from '@org-press/tools';
 *
 * export default {
 *   contentDir: 'content',
 *   plugins: [...allPlugins],
 * };
 * ```
 */

// Plugin exports
export { fmtPlugin } from "./plugins/fmt.js";
export { lintPlugin } from "./plugins/lint.js";
export { typeCheckPlugin } from "./plugins/type-check.js";

// Convenience export for all plugins
import { fmtPlugin } from "./plugins/fmt.js";
import { lintPlugin } from "./plugins/lint.js";
import { typeCheckPlugin } from "./plugins/type-check.js";

/**
 * All tools plugins bundled together
 *
 * @example
 * ```typescript
 * import { allPlugins } from '@org-press/tools';
 *
 * export default {
 *   plugins: [...allPlugins],
 * };
 * ```
 */
export const allPlugins = [fmtPlugin, lintPlugin, typeCheckPlugin];

// Type exports
export type {
  CollectedBlock,
  CollectOptions,
  FmtOptions,
  LintOptions,
  TypeCheckOptions,
} from "./types.js";

// Constant exports
export {
  PRETTIER_PARSERS,
  LANGUAGE_EXTENSIONS,
  LINT_LANGUAGES,
  TYPECHECK_LANGUAGES,
} from "./types.js";

// Utility exports (for advanced use cases)
export { collectCodeBlocks } from "./utils/block-collector.js";
export { writeBlockContent, writeBlockContentBatch } from "./utils/block-writer.js";
export { loadPrettierConfig, loadTsConfig, findEslintConfig } from "./utils/config-loader.js";
