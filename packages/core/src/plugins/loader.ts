import type { BlockPlugin, CodeBlock } from "./types.ts";
import type { OrgPressConfig } from "../config/types.ts";
import { usesPlugin } from "./utils.ts";

/**
 * Plugin loader system
 *
 * Responsibilities:
 * - Load plugins from user config and built-ins
 * - Provide plugin matching logic
 * - Cache loaded plugins for performance
 *
 * Note: Plugins can be imported from .org files using standard imports:
 * import { plugin } from "./my-plugin.org?name=plugin";
 */

/**
 * Result of loading plugins
 */
export interface LoadedPlugins {
  /** Sorted array of plugins (by priority) */
  plugins: BlockPlugin[];
}

// Cache for loaded plugins
// Invalidated when config changes or explicitly cleared
let cachedPlugins: LoadedPlugins | null = null;

/**
 * Load and register all plugins from config
 *
 * Process:
 * 1. Add user plugins from config
 * 2. Add built-in plugins (JavaScript, TypeScript, TSX, JSX)
 * 3. Sort by priority (higher first)
 *
 * @param config - Resolved org-press config
 * @returns Loaded plugins
 *
 * @example
 * import { cssPlugin, serverPlugin } from "org-press";
 * const config = await loadConfig(".org-press/config.ts");
 * const { plugins } = await loadPlugins(config);
 *
 * // Use plugins
 * const plugin = findMatchingPlugin(plugins, codeBlock);
 */
export async function loadPlugins(
  config: OrgPressConfig
): Promise<LoadedPlugins> {
  // Return cached if available
  if (cachedPlugins) return cachedPlugins;

  const plugins: BlockPlugin[] = [];

  // 1. Add user plugins
  plugins.push(...(config.plugins ?? []));

  // 2. Add built-in plugins (JS, TS, TSX, JSX)
  // Each language has its own plugin with the correct defaultExtension
  // so Vite can transpile based on file extension automatically
  const { builtinPlugins } = await import("./builtin/index.ts");
  plugins.push(...builtinPlugins);

  // 3. Sort by priority (higher first)
  // Plugins without priority default to 0
  plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Cache result
  cachedPlugins = { plugins };
  return cachedPlugins;
}


/**
 * Find plugin that matches a code block
 *
 * Matching priority:
 * 1. Custom matcher function (plugin.matches())
 * 2. Explicit :use parameter
 * 3. Language matching (plugin.languages)
 *
 * Returns the first matching plugin (plugins are pre-sorted by priority)
 *
 * @param plugins - Array of plugins to search (should be pre-sorted by priority)
 * @param block - Code block to match
 * @returns Matching plugin or null if no match
 *
 * @example
 * const plugin = findMatchingPlugin(plugins, {
 *   language: "javascript",
 *   value: "console.log('hello')",
 *   meta: ":use dom | withSourceCode"
 * });
 *
 * if (plugin) {
 *   const result = await plugin.transform(block, context);
 * }
 */
export function findMatchingPlugin(
  plugins: BlockPlugin[],
  block: CodeBlock
): BlockPlugin | null {
  // Two-pass matching to ensure :use parameters take precedence over language

  // Pass 1: Check custom matchers and :use parameters for ALL plugins first
  for (const plugin of plugins) {
    // 1. Check custom matcher (highest priority)
    if (plugin.matches?.(block)) {
      return plugin;
    }

    // 2. Check :use parameter (explicit plugin selection)
    // This should match before any language-based matching
    if (block.meta && usesPlugin(block.meta, plugin.name)) {
      return plugin;
    }
  }

  // Pass 2: Fall back to language matching
  for (const plugin of plugins) {
    if (plugin.languages?.includes(block.language)) {
      return plugin;
    }
  }

  return null;
}

/**
 * Invalidate plugin cache
 *
 * Call this when:
 * - Config changes (HMR)
 * - Tests need fresh plugin state
 * - Manual cache clearing needed
 *
 * Next call to loadPlugins() will reload from scratch
 *
 * @example
 * // In HMR handler
 * if (configChanged) {
 *   invalidatePluginCache();
 *   await loadPlugins(newConfig);
 * }
 */
export function invalidatePluginCache(): void {
  cachedPlugins = null;
}

/**
 * Get currently cached plugins without loading
 *
 * Useful for debugging or tools that need to inspect loaded plugins
 *
 * @returns Currently cached plugins or null if not loaded
 */
export function getCachedPlugins(): LoadedPlugins | null {
  return cachedPlugins;
}
