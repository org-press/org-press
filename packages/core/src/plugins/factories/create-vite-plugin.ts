/**
 * CreateVitePlugin Factory
 *
 * Register Vite plugins from org-press plugins.
 * Allows plugins to contribute Vite plugins that get merged into the final Vite config.
 *
 * @example
 * ```typescript
 * import { CreateVitePlugin } from "org-press";
 *
 * // Add a custom transform
 * export const myVitePlugin = CreateVitePlugin("my-transform", {
 *   enforce: "pre",
 *   transform(code, id) {
 *     if (id.endsWith(".special")) {
 *       return transformSpecialFile(code);
 *     }
 *   },
 * });
 *
 * // Add virtual module support
 * export const virtualModulePlugin = CreateVitePlugin("virtual-config", {
 *   resolveId(id) {
 *     if (id === "virtual:my-config") {
 *       return "\0virtual:my-config";
 *     }
 *   },
 *   load(id) {
 *     if (id === "\0virtual:my-config") {
 *       return `export default ${JSON.stringify(myConfig)}`;
 *     }
 *   },
 * });
 * ```
 */

import type { Plugin as VitePlugin } from "vite";
import type { OrgPressPlugin } from "../types.ts";

/**
 * Vite plugin configuration without the name (name is provided separately)
 */
export interface VitePluginConfig extends Omit<VitePlugin, "name"> {
  /** When to run: 'pre' | 'post' | undefined */
  enforce?: "pre" | "post";
  /** When to apply: 'build' | 'serve' | undefined (both) */
  apply?: "build" | "serve";
}

/**
 * Create an org-press plugin that registers a Vite plugin
 *
 * The Vite plugin will be automatically included in the Vite configuration
 * when org-press is initialized.
 *
 * @param name - Unique name for the plugin (will be prefixed with 'org-press:')
 * @param config - Vite plugin configuration (all Vite plugin hooks except 'name')
 * @returns An OrgPressPlugin that registers the Vite plugin
 *
 * @example
 * ```typescript
 * import { CreateVitePlugin } from "org-press";
 *
 * export const mdxPlugin = CreateVitePlugin("mdx-support", {
 *   enforce: "pre",
 *   transform(code, id) {
 *     if (id.endsWith(".mdx")) {
 *       return compileMdx(code);
 *     }
 *   },
 * });
 * ```
 */
export function CreateVitePlugin(
  name: string,
  config: VitePluginConfig
): OrgPressPlugin {
  const vitePlugin: VitePlugin = {
    name: `org-press:${name}`,
    ...config,
  };

  return {
    name: `vite:${name}`,
    _type: "vite",
    _config: { vitePlugin },

    setup(ctx) {
      ctx.addVitePlugin(vitePlugin);
    },
  };
}
