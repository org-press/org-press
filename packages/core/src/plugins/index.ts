/**
 * Unified Plugin API
 *
 * A plugin system where core is minimal and everything else is plugins.
 *
 * Design principles:
 * 1. Core is just orchestration - pipeline stages + plugin registration
 * 2. Everything is a plugin - TOC, headings, highlight, code blocks, drawers
 * 3. Simple things are simple - factory functions for common patterns
 * 4. Complex things are possible - full setup(ctx) API as escape hatch
 * 5. Leverage existing ecosystem - rehype/uniorg plugins work directly
 *
 * @example
 * ```typescript
 * import {
 *   CreateDrawer,
 *   CreateBlock,
 *   CreateTransformer,
 *   CreateRehypePlugin,
 *   CreateCommand,
 *   CreatePlugin,
 * } from 'org-press';
 * import rehypeHighlight from 'rehype-highlight';
 *
 * export default {
 *   plugins: [
 *     // Rehype plugins
 *     CreateRehypePlugin(rehypeHighlight),
 *
 *     // Drawers
 *     CreateDrawer('AI', (d) => `<details class="ai">${d.html}</details>`),
 *
 *     // Code blocks
 *     CreateBlock('jscad', {
 *       transform: (code, ctx) => ({
 *         html: `<div id="${ctx.blockId}" class="jscad"></div>`,
 *         script: jscadRuntime(code),
 *       }),
 *     }),
 *
 *     // Transformers for :use pipeline
 *     CreateTransformer('dom', {
 *       onBuild: (input, ctx) => ({
 *         html: `<div id="${ctx.id}">${execute(input.code)}</div>`,
 *       }),
 *       client: () => import('./transformers/dom.client'),
 *     }),
 *
 *     // CLI commands
 *     CreateCommand('fmt', {
 *       description: 'Format code blocks',
 *       execute: async (args, ctx) => formatBlocks(ctx),
 *     }),
 *
 *     // Complex plugin with full control
 *     CreatePlugin('my-plugin', (ctx) => {
 *       ctx.hook('build:start', () => console.log('Building...'));
 *       ctx.onElement('table', transformTable);
 *     }),
 *   ],
 * };
 * ```
 */

// ===== Types =====
export type {
  // Core plugin interface
  OrgPressPlugin,
  PluginType,
  PluginContext,

  // Pipeline
  PipelineStage,

  // Node types
  DrawerNode,
  CodeBlockNode,

  // Transform types
  TransformContext,
  BlockTransformContext,
  TransformResult,

  // Transformer types (for :use)
  TransformerOptions,
  TransformerInput,
  TransformerOutput,
  BuildContext,
  ServerContext,
  ClientModule,
  ClientContext,

  // Handler types
  ElementHandler,
  DrawerHandler,
  BlockHandler,
  StageHandler,
  StagePayload,

  // Command types
  CommandOptions,
  CommandContext,
  ArgDefinition,
  ParsedArgs,

  // Middleware types
  HttpMethod,
  MiddlewareHandler,
  MiddlewareOptions,

  // Ecosystem types
  RehypePlugin,
  UniorgPlugin,

  // Utility types
  Logger,
  ContentHelpers,
  OrgPressConfig,
} from "./types.ts";

// ===== Factory Functions =====
export {
  // Escape hatch
  CreatePlugin,

  // Transformer for :use
  CreateTransformer,
  isClientDynamicImport,
  isClientInlineScript,
  getClientType,

  // Drawer handling
  CreateDrawer,
  matchesDrawerName,

  // Block handling
  CreateBlock,
  matchesLanguage,

  // Generic element handling
  CreateOrgElement,

  // Ecosystem passthroughs
  CreateRehypePlugin,
  CreateUniorgPlugin,

  // CLI commands
  CreateCommand,
  parseArgs,
  generateHelp,

  // Vite plugin integration
  CreateVitePlugin,

  // Dev server middleware
  CreateMiddlewarePlugin,
} from "./factories/index.ts";

// Re-export factory-specific types
export type {
  PluginSetupFunction,
  DrawerTransformFn,
  DrawerPluginOptions,
  BlockOptions,
  BlockContext,
  OrgElementOptions,
  VitePluginConfig,
} from "./factories/index.ts";

// ===== Runtime =====
export { PluginContextImpl } from "./context.ts";
export { PluginRegistry } from "./registry.ts";
