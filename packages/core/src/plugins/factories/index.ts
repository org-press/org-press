/**
 * Plugin Factory Functions
 *
 * All factory functions return OrgPressPlugin objects.
 * Use the simpler factories when possible, fall back to CreatePlugin for complex cases.
 *
 * | Factory | Purpose |
 * |---------|---------|
 * | CreatePlugin | Full control escape hatch |
 * | CreateTransformer | Pipeline stages for :use (unified modes + wrappers) |
 * | CreateDrawer | Handle org-mode drawers (:AI:, :NOTE:) |
 * | CreateBlock | Handle code blocks by language |
 * | CreateOrgElement | Handle any org-mode AST element |
 * | CreateRehypePlugin | Passthrough for rehype plugins |
 * | CreateUniorgPlugin | Passthrough for uniorg plugins |
 * | CreateCommand | Add CLI commands |
 */

// Escape hatch for complex plugins
export { CreatePlugin } from "./create-plugin.ts";
export type { PluginSetupFunction } from "./create-plugin.ts";

// Transformer for :use pipeline
export { CreateTransformer } from "./create-transformer.ts";
export {
  isClientDynamicImport,
  isClientInlineScript,
  getClientType,
} from "./create-transformer.ts";

// Drawer handling
export { CreateDrawer, matchesDrawerName } from "./create-drawer.ts";
export type { DrawerTransformFn, DrawerPluginOptions } from "./create-drawer.ts";

// Code block handling
export { CreateBlock, matchesLanguage } from "./create-block.ts";
export type { BlockOptions, BlockContext } from "./create-block.ts";

// Generic element handling
export { CreateOrgElement } from "./create-org-element.ts";
export type { OrgElementOptions } from "./create-org-element.ts";

// Rehype ecosystem passthrough
export { CreateRehypePlugin } from "./create-rehype-plugin.ts";

// Uniorg ecosystem passthrough
export { CreateUniorgPlugin } from "./create-uniorg-plugin.ts";

// CLI commands
export { CreateCommand, parseArgs, generateHelp } from "./create-command.ts";

// Vite plugin integration
export { CreateVitePlugin } from "./create-vite-plugin.ts";
export type { VitePluginConfig } from "./create-vite-plugin.ts";

// Dev server middleware
export { CreateMiddlewarePlugin } from "./create-middleware-plugin.ts";
export type { MiddlewareOptions, MiddlewareHandler } from "./create-middleware-plugin.ts";
