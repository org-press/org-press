/**
 * Plugin Presets
 *
 * Pre-configured arrays of plugins that users can spread into their config.
 * No magic preset resolution - just arrays.
 *
 * @example
 * ```typescript
 * import { defaultPlugins } from 'org-press';
 *
 * export default {
 *   plugins: [...defaultPlugins],
 * };
 * ```
 */

import type { OrgPressPlugin } from "./types.ts";

// Content plugins
import { domPlugin } from "./builtin/dom.ts";
import { javascriptPlugin } from "./builtin/javascript.ts";
import { typescriptPlugin } from "./builtin/typescript.ts";
import { cssPlugin } from "./builtin/css.ts";
import { serverPlugin } from "./builtin/server.ts";
import { calloutDrawerPlugin, quoteDrawerPlugin } from "./builtin/default-elements.ts";

/**
 * Default plugins for most use cases
 *
 * Includes:
 * - domPlugin: DOM rendering for :use dom blocks
 * - javascriptPlugin: JavaScript/JS block handling
 * - typescriptPlugin: TypeScript/TS block handling
 * - cssPlugin: CSS block handling
 * - serverPlugin: Server-side execution for :use server blocks
 * - calloutDrawerPlugin: NOTE, INFO, TIP, WARNING, etc. drawers
 * - quoteDrawerPlugin: QUOTE drawer
 *
 * Does NOT include:
 * - CLI plugins (separate concern)
 */
export const defaultPlugins: OrgPressPlugin[] = [
  domPlugin as OrgPressPlugin,
  javascriptPlugin as OrgPressPlugin,
  typescriptPlugin as OrgPressPlugin,
  cssPlugin as OrgPressPlugin,
  serverPlugin as OrgPressPlugin,
  calloutDrawerPlugin as OrgPressPlugin,
  quoteDrawerPlugin as OrgPressPlugin,
];

/**
 * Minimal plugins - empty array
 *
 * Use this when you want complete control over which plugins are loaded.
 * You'll need to add every plugin you need explicitly.
 */
export const minimalPlugins: OrgPressPlugin[] = [];

