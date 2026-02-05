/**
 * CreateRehypePlugin - Passthrough for existing rehype plugins
 *
 * Allows using any rehype plugin from the unified ecosystem directly
 * in org-press configuration.
 *
 * @example
 * ```typescript
 * import rehypeHighlight from 'rehype-highlight';
 * import rehypeSlug from 'rehype-slug';
 * import rehypeAutolinkHeadings from 'rehype-autolink-headings';
 *
 * // Basic usage
 * const highlight = CreateRehypePlugin(rehypeHighlight);
 *
 * // With options
 * const highlightWithLangs = CreateRehypePlugin(rehypeHighlight, {
 *   languages: ['javascript', 'typescript', 'python'],
 * });
 *
 * // Chaining common rehype plugins
 * export default {
 *   plugins: [
 *     CreateRehypePlugin(rehypeSlug),
 *     CreateRehypePlugin(rehypeAutolinkHeadings, {
 *       behavior: 'wrap',
 *     }),
 *     CreateRehypePlugin(rehypeHighlight),
 *   ],
 * };
 * ```
 */

import type {
  OrgPressPlugin,
  RehypePlugin,
} from "../types.ts";

/**
 * Create a rehype plugin wrapper
 *
 * @param plugin - The rehype plugin
 * @param options - Optional plugin options
 * @returns OrgPressPlugin
 */
export function CreateRehypePlugin(
  plugin: RehypePlugin,
  options?: unknown
): OrgPressPlugin {
  // Try to get a name from the plugin function
  const pluginName = typeof plugin === "function" && plugin.name
    ? plugin.name
    : "anonymous";

  return {
    name: `rehype:${pluginName}`,
    _type: "rehype",
    _config: {
      plugin,
      options,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      ctx.useRehype(plugin, options);
    },
  };
}

export default CreateRehypePlugin;
