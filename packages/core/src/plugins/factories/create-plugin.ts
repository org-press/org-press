/**
 * CreatePlugin - Full control escape hatch
 *
 * For complex plugins that need access to the full PluginContext API.
 * Use the simpler factory functions (CreateDrawer, CreateBlock, etc.) when possible.
 *
 * @example
 * ```typescript
 * const aiPlugin = CreatePlugin('ai', (ctx) => {
 *   // Handle AI drawers
 *   ctx.onDrawer('AI', (drawer) => {
 *     return `<details class="ai">${drawer.html}</details>`;
 *   });
 *
 *   // Add CLI command
 *   ctx.addCommand('ai', {
 *     description: 'AI assistant for code blocks',
 *     execute: async (args) => { return 0; },
 *   });
 *
 *   // Add transformer for :use ai | ...
 *   ctx.addTransformer('ai', {
 *     onBuild: (input, ctx) => ({
 *       html: `<div class="ai-enhanced">${input.html}</div>`,
 *     }),
 *   });
 *
 *   // Hook into pipeline
 *   ctx.hook('render:after', (payload) => {
 *     payload.metadata = { ...payload.metadata, aiProcessed: true };
 *   });
 * });
 * ```
 */

import type { OrgPressPlugin, PluginContext } from "../types.ts";

/**
 * Setup function type for CreatePlugin
 */
export type PluginSetupFunction = (ctx: PluginContext) => void | Promise<void>;

/**
 * Create a plugin with full access to the PluginContext API
 *
 * This is the escape hatch for complex plugins that need to:
 * - Register multiple element handlers
 * - Hook into multiple pipeline stages
 * - Add both CLI commands and transformers
 * - Use shared state between plugins
 *
 * @param name - Unique plugin name
 * @param setup - Setup function called when plugin is registered
 * @returns OrgPressPlugin
 */
export function CreatePlugin(
  name: string,
  setup: PluginSetupFunction
): OrgPressPlugin {
  return {
    name,
    _type: "generic",
    setup,
  };
}

export default CreatePlugin;
