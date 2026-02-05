/**
 * CreateDrawer - Convenience factory for drawer element handlers
 *
 * This is a specialized factory for handling org-mode drawers - elements
 * that contain content between :DRAWER_NAME: and :END: markers. It provides
 * convenience sugar over the more generic CreateOrgElement factory.
 *
 * For custom element handling beyond drawers, use CreateOrgElement directly.
 *
 * @example
 * ```typescript
 * // Simple drawer - one liner
 * const aiDrawer = CreateDrawer('AI', (drawer) => {
 *   return `<details class="ai-drawer">
 *     <summary>AI Generated</summary>
 *     <div>${drawer.html}</div>
 *   </details>`;
 * });
 *
 * // Multiple drawer names
 * const noteDrawer = CreateDrawer(['NOTE', 'INFO', 'TIP'], (drawer) => {
 *   return `<aside class="${drawer.name.toLowerCase()}">${drawer.html}</aside>`;
 * });
 *
 * // Remove a drawer from output
 * const hideProperties = CreateDrawer('PROPERTIES', () => null);
 *
 * // Dynamic matching with properties (new API)
 * const detailsDrawer = CreateDrawer(
 *   { matches: (d) => !!d.properties?.SUMMARY, priority: 5 },
 *   (drawer) => `<details><summary>${drawer.properties.SUMMARY}</summary>${drawer.html}</details>`
 * );
 * ```
 */

import type {
  OrgPressPlugin,
  DrawerNode,
  TransformContext,
} from "../types.ts";

/**
 * Drawer plugin options for dynamic matching
 *
 * Use this when you want to match drawers based on their properties
 * or other conditions rather than just by name.
 */
export interface DrawerPluginOptions {
  /**
   * Function to determine if this plugin handles a drawer
   *
   * @param drawer - The drawer node with name, children, html, and properties
   * @returns true if this plugin should handle the drawer
   */
  matches: (drawer: DrawerNode) => boolean;

  /**
   * Priority for matching (higher = matched first)
   * Default: 10
   *
   * Use lower priority (e.g., 5) for generic fallback handlers.
   * Use higher priority (e.g., 20) for specific overrides.
   */
  priority?: number;
}

/**
 * Drawer transform function type
 *
 * @param drawer - The drawer node with name, children, and pre-rendered html
 * @param ctx - Transform context with file path and config
 * @returns HTML string to replace the drawer, or null to remove from output
 */
export type DrawerTransformFn = (
  drawer: DrawerNode,
  ctx: TransformContext
) => string | null | Promise<string | null>;

/**
 * Create a drawer plugin
 *
 * @param nameOrOptions - Drawer name(s) to handle (case-insensitive) OR options with matches function
 * @param transform - Transform function that receives the drawer and returns HTML
 * @returns OrgPressPlugin
 *
 * @example
 * // Fixed names (existing API)
 * const noteDrawer = CreateDrawer(['NOTE', 'TIP'], (drawer) => ...);
 *
 * // Dynamic matching (new API)
 * const detailsDrawer = CreateDrawer(
 *   { matches: (d) => !!d.properties?.SUMMARY, priority: 5 },
 *   (drawer) => ...
 * );
 */
export function CreateDrawer(
  nameOrOptions: string | string[] | DrawerPluginOptions,
  transform: DrawerTransformFn
): OrgPressPlugin {
  // Check if using new options-based API with matches function
  if (typeof nameOrOptions === "object" && "matches" in nameOrOptions) {
    const { matches, priority = 10 } = nameOrOptions;

    return {
      name: `drawer:dynamic`,
      _type: "drawer",
      _config: {
        matches,
        priority,
        transform,
      },

      // Setup function to register with PluginContext
      setup(ctx) {
        ctx.onDrawerMatch(matches, priority, (drawer, transformCtx) => {
          return transform(drawer, transformCtx);
        });
      },
    };
  }

  // Existing fixed names logic
  const names = Array.isArray(nameOrOptions) ? nameOrOptions : [nameOrOptions];
  const normalizedNames = names.map((n) => n.toUpperCase());

  const pluginName = Array.isArray(nameOrOptions)
    ? `drawer:${names.join(",")}`
    : `drawer:${nameOrOptions}`;

  return {
    name: pluginName,
    _type: "drawer",
    _config: {
      drawerNames: normalizedNames,
      transform,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      ctx.onDrawer(names, (drawer, transformCtx) => {
        return transform(drawer, transformCtx);
      });
    },
  };
}

/**
 * Helper to check if a drawer matches a list of names
 *
 * @param drawer - Drawer node to check
 * @param names - List of drawer names (should be uppercase)
 * @returns true if drawer name matches any in the list
 */
export function matchesDrawerName(
  drawer: DrawerNode,
  names: string[]
): boolean {
  return names.includes(drawer.name.toUpperCase());
}

export default CreateDrawer;
