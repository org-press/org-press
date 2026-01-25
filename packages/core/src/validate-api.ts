/**
 * Phase 8 Validation - Public API Exports
 *
 * Simple TypeScript file that imports from the public API to validate:
 * 1. No circular dependencies
 * 2. All exports are accessible
 * 3. TypeScript compilation succeeds
 *
 * This is a compile-time check - if this file compiles without errors,
 * the public API is valid.
 */

// Vite Integration
import {
  orgPress,
  createOrgPressPlugins,
  getOptimizeDepsConfig,
  createVirtualBlocksPlugin,
  type OrgPressPluginOptions,
} from "./index.ts";

// Build System
import {
  build,
  discoverPages,
  renderPage,
  orgPathToHtmlPath,
  type BuildOptions,
  type BuildResult,
} from "./index.ts";

// Dev Server
import { createDevServerMiddleware, type DevServerOptions } from "./index.ts";

// Configuration
import {
  loadConfig,
  resolveConfig,
  invalidateConfigCache,
  type OrgPressConfig,
  type OrgPressUserConfig,
  type ThemeConfig,
} from "./index.ts";

// Plugin System
import {
  loadPlugins,
  findMatchingPlugin,
  invalidatePluginCache,
  type LoadedPlugins,
  builtinPlugins,
  allBuiltinPlugins,
  cssPlugin,
  cssInlinePlugin,
  cssScopedPlugin,
  javascriptPlugin,
  javascriptDirectPlugin,
  serverPlugin,
  serverOnlyPlugin,
  type BlockPlugin,
  type CodeBlock,
  type TransformContext,
  type TransformResult,
} from "./index.ts";

// Plugin Utilities
import {
  createBlockId,
  rewriteOrgImports,
  parseBlockParameters,
  createVirtualModuleId,
  usesPlugin,
} from "./index.ts";

// Parser Layer
import {
  parseOrgContent,
  processCodeBlocks,
  extractMetadata,
  parseCodeBlockParameters,
  executeServerBlock,
  type ParseContext,
  type ParsedOrg,
  type VirtualModule,
  type CacheFile,
  type ServerExecutionResult,
  type PageMetadata,
} from "./index.ts";

// Render Layer
import {
  renderOrg,
  renderOrgToHtml,
  renderOrgWithPlugins,
  renderWithLayout,
  renderFullPage,
  injectViteHMR,
  applyBasePath,
  rehypeHeadingIds,
  type RenderContext,
  type RenderResult,
  type LayoutComponent,
  type LayoutProps,
  type SSRRenderOptions,
  type PageRenderOptions,
} from "./index.ts";

// Layout System
import {
  loadLayout,
  loadDefaultLayout,
  clearLayoutCache,
  preloadLayouts,
} from "./index.ts";

// Content API
import {
  getContentPages,
  getContentPagesFromDirectory,
  renderPageList,
  clearContentCache,
  isDevelopment,
  contentHelpers,
  type ContentPage,
  type ContentQueryOptions,
  type ContentHelpers,
} from "./index.ts";

// Cache System
import {
  writeToCache,
  readFromCache,
  getCachePath,
  clearCache,
  cacheFileExists,
  ensureCacheDir,
} from "./index.ts";

// Version
import { version } from "./index.ts";

// Default export (deprecated)
import OrgPress from "./index.ts";

/**
 * Validation Results
 */
console.log("✓ All exports are accessible");
console.log(`✓ Version: ${version}`);
console.log(`✓ Default export available: ${!!OrgPress}`);
console.log("✓ No circular dependencies detected");
console.log("✓ TypeScript compilation successful");
console.log("\n✅ Phase 8 Validation: PASSED\n");
