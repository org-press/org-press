/**
 * Built-in plugins for org-press
 *
 * These plugins provide core functionality for common block types.
 * They are automatically included in all presets and can be used
 * without additional configuration.
 */

import type { BlockPlugin } from "../types.ts";
import {
  cssPlugin,
  cssInlinePlugin,
  cssScopedPlugin,
} from "./css.ts";
import {
  javascriptPlugin,
  javascriptDirectPlugin,
} from "./javascript.ts";
import { typescriptPlugin } from "./typescript.ts";
import { tsxPlugin } from "./tsx.ts";
import { jsxPlugin } from "./jsx.ts";
import {
  createServerPlugin,
  serverPlugin,
  serverOnlyPlugin,
} from "./server.ts";
import { createDefaultJavaScriptHandler } from "./javascript-handler.ts";
import { createServerHandler } from "../handler-factory.ts";
import { apiPlugin } from "./api/index.ts";
import { fmtPlugin } from "./fmt.ts";
import { lintPlugin } from "./lint.ts";
import { typeCheckPlugin } from "./type-check.ts";
import { previewPlugin } from "./preview.ts";
import { sourceOnlyPlugin } from "./source-only.ts";
import { silentPlugin } from "./silent.ts";
import { rawPlugin } from "./raw.ts";

/**
 * Export all plugins
 */
export {
  // Mode plugins (match :use preview, :use sourceOnly, etc.)
  previewPlugin,
  sourceOnlyPlugin,
  silentPlugin,
  rawPlugin,
  // CSS plugins
  cssPlugin,
  cssInlinePlugin,
  cssScopedPlugin,
  // JavaScript plugins
  javascriptPlugin,
  javascriptDirectPlugin,
  // TypeScript plugins
  typescriptPlugin,
  // TSX plugins
  tsxPlugin,
  // JSX plugins
  jsxPlugin,
  // Server plugins
  createServerPlugin,
  serverPlugin,
  serverOnlyPlugin,
  // API plugin
  apiPlugin,
  // CLI plugins
  fmtPlugin,
  lintPlugin,
  typeCheckPlugin,
  // Server handlers
  createServerHandler,
  createDefaultJavaScriptHandler,
};

/**
 * Default built-in plugins
 *
 * Includes mode plugins and language plugins.
 * Mode plugins (preview, sourceOnly, etc.) have higher priority and match :use parameter.
 * Language plugins handle transpilation when no mode is explicitly specified.
 *
 * @example
 * import { cssPlugin, serverPlugin } from "org-press";
 *
 * export default {
 *   plugins: [cssPlugin, serverPlugin]
 * };
 */
export const builtinPlugins: BlockPlugin[] = [
  // Mode plugins - higher priority (50), match :use parameter
  previewPlugin,     // Priority 50 - :use preview
  sourceOnlyPlugin,  // Priority 50 - :use sourceOnly
  silentPlugin,      // Priority 50 - :use silent
  rawPlugin,         // Priority 50 - :use raw
  // Language plugins - lower priority (10), match by language
  javascriptPlugin,  // Priority 10 - handles .js files
  typescriptPlugin,  // Priority 10 - handles .ts files (Vite transpiles)
  tsxPlugin,         // Priority 10 - handles .tsx files (Vite transpiles)
  jsxPlugin,         // Priority 10 - handles .jsx files (Vite transpiles)
];

/**
 * All built-in plugins (including variants)
 *
 * Use this if you want to include all variants in your preset.
 * Most users should just use `builtinPlugins`.
 */
export const allBuiltinPlugins: BlockPlugin[] = [
  // Main plugins (sorted by priority)
  apiPlugin,         // Priority 100 - handles :use api before other plugins
  previewPlugin,     // Priority 50 - :use preview
  sourceOnlyPlugin,  // Priority 50 - :use sourceOnly
  silentPlugin,      // Priority 50 - :use silent
  rawPlugin,         // Priority 50 - :use raw
  serverPlugin,      // Priority varies
  javascriptPlugin,  // Priority 10
  typescriptPlugin,  // Priority 10
  tsxPlugin,         // Priority 10
  jsxPlugin,         // Priority 10
  cssPlugin,         // Priority 10
  // Variants
  cssInlinePlugin,
  cssScopedPlugin,
  javascriptDirectPlugin,
  serverOnlyPlugin,
  // CLI-only plugins
  fmtPlugin,
  lintPlugin,
  typeCheckPlugin,
];
