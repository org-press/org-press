/**
 * CreateTransformer - Unified factory for :use pipeline stages
 *
 * Transformers are the building blocks of the `:use` parameter pipeline.
 * Both "modes" (dom, server, react) and "wrappers" (source, collapse)
 * are just transformers with different hooks.
 *
 * @example
 * ```typescript
 * // Complex transformer with separate client module
 * CreateTransformer('dom', {
 *   onBuild: (input, ctx) => ({
 *     html: `<div id="${ctx.id}">${execute(input.code)}</div>`,
 *   }),
 *   client: () => import('./dom.client'),
 * });
 *
 * // Simple transformer with inline client code
 * CreateTransformer('source', {
 *   onBuild: (input, ctx) => ({
 *     html: `${input.html}<pre>${ctx.code}</pre>`,
 *   }),
 *   client: `
 *     element.querySelector('pre').addEventListener('dblclick', () => {
 *       navigator.clipboard.writeText(element.dataset.source);
 *     });
 *   `,
 * });
 *
 * // HTML-only transformer (no client code)
 * CreateTransformer('collapse', {
 *   onBuild: (input, ctx) => ({
 *     html: `<details><summary>Show</summary>${input.html}</details>`,
 *   }),
 * });
 *
 * // Server execution transformer
 * CreateTransformer('server', {
 *   onServer: async (code, ctx) => {
 *     return await ctx.execute(code);
 *   },
 *   onBuild: (input, ctx) => ({
 *     html: `<div class="server-result">${input.result}</div>`,
 *   }),
 * });
 * ```
 */

import type {
  OrgPressPlugin,
  TransformerOptions,
  TransformerInput,
  TransformerOutput,
  BuildContext,
  ServerContext,
  ClientModule,
} from "../types.ts";

/**
 * Create a transformer for the :use pipeline
 *
 * Transformers can have three hooks:
 * - `onBuild`: Runs at build time (SSG/SSR) in Node.js
 * - `onServer`: Runs for :use server blocks in Node.js
 * - `client`: Runs in browser for interactivity/hydration
 *
 * The `client` option handles code splitting:
 * - `typeof client === 'function'` -> Dynamic import, bundled separately
 * - `typeof client === 'string'` -> Inline script, written to virtual module
 *
 * This ensures server-only code (fs, db, etc.) never ends up in client bundles.
 *
 * @param name - Transformer name (used in :use directive)
 * @param options - Transformer configuration
 * @returns OrgPressPlugin
 */
export function CreateTransformer(
  name: string,
  options: TransformerOptions
): OrgPressPlugin {
  const { onBuild, onServer, client } = options;

  // Create the plugin with transformer configuration
  const plugin: OrgPressPlugin = {
    name: `transformer:${name}`,
    _type: "transformer",
    _config: {
      transformerName: name,
      onBuild,
      onServer,
      client,
      // Store client type for code splitting decisions
      clientType: typeof client === "function" ? "dynamic" : typeof client === "string" ? "inline" : "none",
    },
  };

  // Setup function to register the transformer with PluginContext
  plugin.setup = (ctx) => {
    ctx.addTransformer(name, options);
  };

  return plugin;
}

/**
 * Type guard to check if client is a dynamic import function
 */
export function isClientDynamicImport(
  client: TransformerOptions["client"]
): client is () => Promise<ClientModule> {
  return typeof client === "function";
}

/**
 * Type guard to check if client is an inline script string
 */
export function isClientInlineScript(
  client: TransformerOptions["client"]
): client is string {
  return typeof client === "string";
}

/**
 * Get the client type for bundling decisions
 */
export function getClientType(
  client: TransformerOptions["client"]
): "dynamic" | "inline" | "none" {
  if (typeof client === "function") return "dynamic";
  if (typeof client === "string") return "inline";
  return "none";
}

export default CreateTransformer;
