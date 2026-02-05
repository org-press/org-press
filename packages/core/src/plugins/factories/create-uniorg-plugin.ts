/**
 * CreateUniorgPlugin - Passthrough for existing uniorg plugins
 *
 * Allows using any uniorg plugin from the unified ecosystem directly
 * in org-press configuration. Uniorg plugins work on the org-mode AST
 * before it's converted to HTML.
 *
 * @example
 * ```typescript
 * import uniorgSlug from 'uniorg-slug';
 * import uniorgExtractKeywords from 'uniorg-extract-keywords';
 *
 * // Basic usage
 * const slugs = CreateUniorgPlugin(uniorgSlug);
 *
 * // With options
 * const keywords = CreateUniorgPlugin(uniorgExtractKeywords, {
 *   keys: ['TITLE', 'AUTHOR', 'DATE'],
 * });
 *
 * export default {
 *   plugins: [
 *     CreateUniorgPlugin(uniorgSlug),
 *     CreateUniorgPlugin(uniorgExtractKeywords),
 *   ],
 * };
 * ```
 */

import type {
  OrgPressPlugin,
  UniorgPlugin,
} from "../types.ts";

/**
 * Create a uniorg plugin wrapper
 *
 * @param plugin - The uniorg plugin
 * @param options - Optional plugin options
 * @returns OrgPressPlugin
 */
export function CreateUniorgPlugin(
  plugin: UniorgPlugin,
  options?: unknown
): OrgPressPlugin {
  // Try to get a name from the plugin function
  const pluginName = typeof plugin === "function" && plugin.name
    ? plugin.name
    : "anonymous";

  return {
    name: `uniorg:${pluginName}`,
    _type: "uniorg",
    _config: {
      plugin,
      options,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      ctx.useUniorg(plugin, options);
    },
  };
}

export default CreateUniorgPlugin;
