/**
 * Org-Press 2 - Public API
 *
 * Main entry point for org-press.
 * Exports everything needed for:
 * - Vite integration
 * - Custom plugin development
 * - Configuration
 * - Build scripts
 * - Content queries
 */

// ===== Vite Integration =====

/**
 * Main Vite plugin for org-press
 *
 * @example
 * // vite.config.ts
 * import { orgPress } from 'org-press';
 *
 * export default defineConfig(async () => ({
 *   plugins: [
 *     ...(await orgPress()),
 *   ],
 * }));
 */
export {
  orgPress,
  createOrgPressPlugins,
  getOptimizeDepsConfig,
} from "./node/vite-plugin-org-press.ts";

export type { OrgPressPluginOptions } from "./node/vite-plugin-org-press.ts";

/**
 * Virtual blocks plugin (typically used internally)
 */
export { createVirtualBlocksPlugin } from "./node/plugins/virtual-blocks.ts";

// ===== Build System =====

/**
 * Build functions for static site generation
 *
 * @example
 * import { build, loadConfig } from 'org-press';
 *
 * const config = await loadConfig();
 * await build({ config });
 */
export {
  build,
  discoverPages,
  renderPage,
  orgPathToHtmlPath,
} from "./node/build/build.ts";

export type { BuildOptions, BuildResult } from "./node/build/build.ts";

export {
  resolveBuildOutputs,
  getSingleFileOutput,
  ensureOutputDir,
  writeOutput,
  cleanOutputDir,
  getRelativeOutputPath,
  orgToOutputPath,
} from "./node/build/output.ts";

export type {
  OutputOptions,
  OutputEntry,
  BuildOutputs,
} from "./node/build/output.ts";

// ===== Dev Server =====

/**
 * Development server middleware
 *
 * @example
 * import { createDevServerMiddleware } from 'org-press';
 *
 * // In Vite plugin
 * configureServer(server) {
 *   const middleware = createDevServerMiddleware({ config, server });
 *   server.middlewares.use(middleware);
 * }
 */
export { createDevServerMiddleware } from "./node/dev-server.ts";

export type { DevServerOptions } from "./node/dev-server.ts";

// ===== Configuration =====

/**
 * Configuration loading and management
 *
 * @example
 * import { loadConfig, resolveConfig } from 'org-press';
 *
 * const config = await loadConfig('.org-press/config.ts');
 */
export {
  loadConfig,
  resolveConfig,
  resolveZeroConfig,
  loadInlineConfig,
  invalidateConfigCache,
  findConfigFile,
} from "./config/loader.ts";

export {
  extractInlineConfig,
  hasInlineConfig,
  mergeInlineConfig,
} from "./config/inline.ts";

export type { InlineConfigResult } from "./config/inline.ts";

export {
  getDefaultConfig,
  getZeroConfig,
  getEnvOverrides,
  getDefaultBuildConcurrency,
  DEFAULT_CONTENT_DIR,
  DEFAULT_OUT_DIR,
  DEFAULT_BASE,
  DEFAULT_CACHE_DIR,
  DEFAULT_THEME,
  DEFAULT_USE,
  DEFAULT_LANGUAGE_DEFAULTS,
  CONFIG_FILE_PATHS,
} from "./config/defaults.ts";

export type { ZeroConfigOptions } from "./config/defaults.ts";

export type {
  OrgPressConfig,
  OrgPressUserConfig,
  ThemeConfig,
} from "./config/types.ts";

// ===== Plugin System =====

/**
 * Plugin loading and management
 *
 * @example
 * import { loadPlugins, findMatchingPlugin } from 'org-press';
 *
 * const { plugins, wrappers } = await loadPlugins(config);
 * const plugin = findMatchingPlugin(plugins, codeBlock);
 */
export {
  loadPlugins,
  findMatchingPlugin,
  invalidatePluginCache,
} from "./plugins/loader.ts";

export type { LoadedPlugins } from "./plugins/loader.ts";

/**
 * Build Block Command
 *
 * Extract and compile named blocks from org files to publishable modules.
 *
 * @example
 * import { buildBlock, extractNamedBlocks } from 'org-press';
 *
 * const blocks = extractNamedBlocks('plugin.org');
 * await buildBlock({ file: 'plugin.org', blocks: ['plugin'], outDir: 'dist' });
 */
export {
  buildBlock,
  extractNamedBlocks,
  parseBuildBlockArgs,
} from "./cli/commands/build-block.ts";

export type {
  BuildBlockOptions,
  BuildBlockResult,
  ExtractedBlock,
} from "./cli/commands/build-block.ts";

/**
 * Block I/O utilities for reading/writing org file blocks
 *
 * @example
 * import { dangerousWriteContentBlock, readContentBlock } from 'org-press';
 *
 * await dangerousWriteContentBlock({
 *   file: 'content/page.org',
 *   block: 'my-diagram',
 *   content: JSON.stringify(data)
 * });
 */
export {
  dangerousWriteContentBlock,
  readContentBlock,
  writeBlockContent,
  readBlockContent,
  findBlock,
} from "./content/block-io.ts";

export type { BlockLocation } from "./content/block-io.ts";

/**
 * Org Import Resolution
 *
 * Pure functions for resolving .org?name= imports.
 * Used by both Vite plugin and LSP - single source of truth.
 *
 * @example
 * import { resolveOrgImport, isOrgImport } from 'org-press';
 *
 * if (isOrgImport(importPath)) {
 *   const result = resolveOrgImport(importPath, importer, contentDir, manifest);
 *   if (result.ok) {
 *     console.log('Resolved to:', result.resolved.virtualModuleId);
 *   }
 * }
 */
export {
  isOrgImport,
  parseOrgImportQuery,
  resolveOrgPath,
  resolveOrgImport,
} from "./resolve/org-imports.ts";

export type {
  OrgImportQuery,
  ResolvedOrgImport,
  OrgImportError,
  OrgImportResult,
} from "./resolve/org-imports.ts";

/**
 * Built-in plugins
 *
 * @example
 * import { builtinPlugins, javascriptPlugin } from 'org-press';
 */
export {
  builtinPlugins,
  allBuiltinPlugins,
  cssPlugin,
  cssInlinePlugin,
  cssScopedPlugin,
  javascriptPlugin,
  javascriptDirectPlugin,
  // Server plugins and factories
  createServerPlugin,
  serverPlugin,
  serverOnlyPlugin,
  // API plugin
  apiPlugin,
  // CLI plugins
  fmtPlugin,
  lintPlugin,
  typeCheckPlugin,
  // Server handlers
  createServerHandler,
  createDefaultJavaScriptHandler,
} from "./plugins/builtin/index.ts";

// API plugin types (re-export for convenience)
export type {
  ApiRequest,
  ApiResponse,
  ApiHandler,
  ApiRouteDefinition,
} from "./plugins/builtin/api/index.ts";

export {
  createApiMiddleware,
  getApiRoutes,
  clearRoutes as clearApiRoutes,
  registerApiRoute,
  isEndpointRegistered,
} from "./plugins/builtin/api/index.ts";

/**
 * Plugin types and interfaces
 *
 * @example
 * import type { BlockPlugin, TransformContext } from 'org-press';
 *
 * export const myPlugin: BlockPlugin = {
 *   name: 'my-plugin',
 *   defaultExtension: 'js',
 *   async transform(block, context) {
 *     return { code: block.value };
 *   },
 * };
 */
export type {
  BlockPlugin,
  CodeBlock,
  TransformContext,
  TransformResult,
  // Server plugin types
  ServerHandler,
  ServerExecutionResult,
  ServerHandlerContext,
  ServerClientContext,
  // CLI plugin types
  CliContext,
  // Org import types
  OrgImport,
  OrgBlock,
  OrgMetadata,
} from "./plugins/types.ts";

// ===== Plugin Utilities =====

/**
 * Utilities for plugin authors
 *
 * @example
 * import { createBlockId, parseBlockParameters } from 'org-press';
 *
 * const blockId = createBlockId(context.orgFilePath, context.blockIndex);
 * const params = parseBlockParameters(block.meta);
 */
export {
  createBlockId,
  rewriteOrgImports,
  parseBlockParameters,
  createVirtualModuleId,
  usesPlugin,
} from "./plugins/utils.ts";

// ===== Preview API =====

/**
 * Preview API for composable block rendering
 *
 * @example
 * import { detectPreview, createBlockContext, defaultPreview } from 'org-press';
 *
 * if (detectPreview(code)) {
 *   const preview = extractPreview(module);
 *   const ctx = createBlockContext({ ... });
 *   const result = preview(executionResult, ctx);
 * }
 */
export {
  detectPreview,
  extractPreview,
  isPreviewFn,
  createBlockContext,
  defaultPreview,
} from "./plugins/preview.ts";

export type {
  PreviewResult,
  PreviewFn,
  Wrapper,
  WrapperFactory,
  BlockContext,
  CreateBlockContextOptions,
} from "./plugins/preview.ts";

/**
 * Preview API initialization
 *
 * @example
 * import { initializePreviewApi } from 'org-press';
 *
 * // Initialize once at startup
 * initializePreviewApi();
 */
export {
  initializePreviewApi,
  isPreviewApiInitialized,
  resetPreviewApiInit,
} from "./plugins/preview-init.ts";

/**
 * Pipe parser for :use syntax
 *
 * @example
 * import { parsePipe, getMode, getWrappers } from 'org-press';
 *
 * const segments = parsePipe("preview | withTabs?default=code");
 * const mode = getMode("preview | withTabs"); // "preview"
 * const wrappers = getWrappers("preview | withTabs"); // [{ name: "withTabs" }]
 */
export {
  parsePipe,
  hasPipe,
  getMode,
  getWrappers,
  serializeSegment,
  resolveUse,
} from "./plugins/pipe-parser.ts";

export type { PipeSegment, ResolveUseOptions } from "./plugins/pipe-parser.ts";

/**
 * Wrapper composition engine
 *
 * @example
 * import { composeWrappers, MapWrapperRegistry, registerWrapper } from 'org-press';
 *
 * const registry = new MapWrapperRegistry();
 * registry.register("withTabs", withTabsFactory);
 *
 * const composed = await composeWrappers(segments, { registry });
 */
export {
  composeWrappers,
  composeWrappersSync,
  MapWrapperRegistry,
  identityWrapper,
  createSimpleWrapper,
  registerWrapper,
  getWrapper,
  globalRegistry,
} from "./plugins/wrapper-compose.ts";

export type {
  WrapperRegistry,
  ComposeOptions,
} from "./plugins/wrapper-compose.ts";

/**
 * Built-in preview wrappers
 *
 * @example
 * import { withSourceCode, withContainer, registerBuiltinWrappers } from 'org-press';
 *
 * // Register all built-in wrappers with global registry
 * registerBuiltinWrappers();
 *
 * // Or use individual wrappers
 * const wrapper = withSourceCode({ position: "before" });
 */
export {
  withSourceCode,
  withContainer,
  withErrorBoundary,
  withConsole,
  withCollapse,
  builtinWrappers,
  registerBuiltinWrappers,
} from "./plugins/preview-wrappers/index.ts";

export type {
  WithSourceCodeConfig,
  WithContainerConfig,
  WithErrorBoundaryConfig,
  WithConsoleConfig,
  WithCollapseConfig,
} from "./plugins/preview-wrappers/index.ts";

/**
 * Built-in mode plugins for block rendering
 *
 * Use these plugins to control how code blocks are rendered:
 * - previewPlugin: Execute code and display result (default behavior)
 * - sourceOnlyPlugin: Display code without execution
 * - silentPlugin: Execute code but produce no output
 * - rawPlugin: Execute and output raw result without formatting
 *
 * These are included in `builtinPlugins` by default.
 *
 * @example
 * ```typescript
 * import { builtinPlugins, previewPlugin, sourceOnlyPlugin } from 'org-press';
 *
 * // In org-press.config.ts - mode plugins are included by default
 * export default {
 *   plugins: builtinPlugins,
 * };
 *
 * // Or use specific mode plugins
 * export default {
 *   plugins: [previewPlugin, sourceOnlyPlugin, ...otherPlugins],
 * };
 * ```
 */
export {
  previewPlugin,
  sourceOnlyPlugin,
  silentPlugin,
  rawPlugin,
} from "./plugins/builtin/index.ts";

/**
 * @deprecated Use mode plugins (previewPlugin, sourceOnlyPlugin, etc.) instead.
 * Modes are now built-in plugins included in `builtinPlugins`.
 */
export {
  previewMode,
  sourceOnlyMode,
  silentMode,
  rawMode,
  builtinModes,
  registerBuiltinModes,
  isMode,
} from "./plugins/modes/index.ts";

/**
 * @deprecated Mode types are deprecated. Use BlockPlugin types instead.
 */
export type {
  Mode,
  ModeFactory,
  PreviewModeConfig,
  SourceOnlyModeConfig,
  SilentModeConfig,
  RawModeConfig,
} from "./plugins/modes/index.ts";

/**
 * Format wrappers for server output
 *
 * @example
 * import { jsonFormat, csvFormat, registerFormatWrappers } from 'org-press';
 *
 * // Register all format wrappers with global registry
 * registerFormatWrappers();
 *
 * // Use in :use pipe
 * // :use server | json
 * // :use server | csv?asTable
 */
export {
  jsonFormat,
  yamlFormat,
  csvFormat,
  htmlFormat,
  formatWrappers,
  registerFormatWrappers,
  isFormat,
} from "./plugins/formats/index.ts";

export type {
  JsonFormatConfig,
  YamlFormatConfig,
  CsvFormatConfig,
  HtmlFormatConfig,
} from "./plugins/formats/index.ts";

// ===== Parser Layer =====

/**
 * Parser layer functions (pure AST transformations)
 *
 * @example
 * import { parseOrgContent } from 'org-press';
 *
 * const parsed = await parseOrgContent(source, context);
 */
export { parseOrgContent, getOrgFileFromUrl } from "./parser/parse-content.ts";

export { processCodeBlocks } from "./parser/exporter.ts";

export { extractMetadata } from "./parser/metadata.ts";

export { parseCodeBlockParameters } from "./parser/parameters.ts";

export { executeServerBlock } from "./parser/execute.ts";

export type {
  ParseContext,
  ParsedOrg,
  VirtualModule,
  CacheFile,
} from "./parser/types.ts";

// Re-export PageMetadata from parser types
export type { PageMetadata } from "./parser/types.ts";

// ===== Render Layer =====

/**
 * Render layer functions (AST to HTML)
 *
 * @example
 * import { renderOrg, renderWithLayout } from 'org-press';
 *
 * const { html } = await renderOrg(ast, context);
 * const withLayout = await renderWithLayout({ ast, context, Layout });
 */
export {
  renderOrg,
  renderOrgToHtml,
  renderOrgWithPlugins,
} from "./render/render.ts";

export { renderWithLayout } from "./render/render-static.tsx";

export {
  renderFullPage,
  injectViteHMR,
  applyBasePath,
} from "./render/render-page.tsx";

export { rehypeHeadingIds } from "./render/rehype-heading-ids.ts";

export { rehypeTocExtract } from "./render/rehype-toc-extract.ts";

export type {
  RenderContext,
  RenderResult,
  LayoutComponent,
  LayoutProps,
  SSRRenderOptions,
  PageRenderOptions,
  TocItem,
} from "./render/types.ts";

// ===== Layout System =====

/**
 * Layout loading and management
 *
 * @example
 * import { loadLayout, loadDefaultLayout } from 'org-press';
 *
 * const Layout = await loadLayout('.org-press/theme', 'blog');
 */
export {
  loadLayout,
  loadDefaultLayout,
  clearLayoutCache,
  preloadLayouts,
} from "./layouts/index.ts";

/**
 * Org-defined layout system
 *
 * Layouts can be defined in .org files using #+LAYOUT: #blockName
 * and #+WRAPPER: #blockName to reference named code blocks.
 *
 * @example
 * import { hasOrgLayout, renderWithOrgLayout } from 'org-press';
 *
 * if (hasOrgLayout(metadata)) {
 *   const { html, hasLayout } = await renderWithOrgLayout(
 *     ast, metadata, renderContent
 *   );
 * }
 */
export {
  extractOrgLayouts,
  extractOrgLayoutsAsync,
  createLayoutFunction,
  createWrapperFunction,
  applyContentWrapper,
  applyLayout,
  hasOrgLayout,
  hasOrgWrapper,
  hasThemeLayout,
  getThemeLayoutName,
  hasCrossFileLayout,
  hasCrossFileWrapper,
  renderWithOrgLayout,
  renderWithOrgLayoutAsync,
} from "./render/org-layout.ts";

export type {
  LayoutBlockType,
  LayoutBlock,
  ExtractedLayouts,
  ExtractLayoutsOptions,
  LayoutContext,
  LayoutFunction,
  WrapperContext,
  WrapperFunction as OrgWrapperFunction,
} from "./render/org-layout.ts";

/**
 * Cross-file layout resolution
 *
 * Enables referencing layouts/wrappers from other .org files:
 * #+LAYOUT: ./layouts.org#base
 * #+WRAPPER: ../shared/wrappers.org#article
 *
 * @example
 * import { isCrossFileLayoutRef, loadCrossFileLayout } from 'org-press';
 *
 * if (isCrossFileLayoutRef(metadata.layout)) {
 *   const layout = await loadCrossFileLayout(
 *     metadata.layout,
 *     currentOrgFile,
 *     contentDir
 *   );
 * }
 */
export {
  isCrossFileLayoutRef,
  parseCrossFileLayoutRef,
  resolveCrossFilePath,
  loadCrossFileLayout,
  clearCrossFileCache,
  invalidateCacheIfChanged,
} from "./render/cross-file-layout.ts";

export type { CrossFileLayoutRef } from "./render/cross-file-layout.ts";

// ===== Content API =====

/**
 * Content querying and rendering
 *
 * Used in server-side blocks via the `content` global.
 *
 * @example
 * // In .org file with :use server
 * const posts = content.getContentPagesFromDirectory('blog');
 * return content.renderPageList(posts);
 */
export {
  getContentPages,
  getContentPagesFromDirectory,
  renderPageList,
  clearContentCache,
  isDevelopment,
  contentHelpers,
} from "./content.ts";

// ===== Routing =====

/**
 * File-based routing for org-press
 *
 * @example
 * import { resolveRoutes, findRoute } from 'org-press';
 *
 * const routes = resolveRoutes('content');
 * const aboutRoute = findRoute(routes, '/about');
 */
export {
  resolveRoutes,
  routeToOutputPath,
  findRoute,
  getChildRoutes,
  getRoutesAtDepth,
  buildRouteTree,
} from "./routing/index.ts";

export type {
  RouteEntry,
  ResolveRoutesOptions,
  RouteTreeNode,
} from "./routing/index.ts";

export type {
  ContentPage,
  ContentQueryOptions,
  ContentHelpers,
} from "./content.ts";

// ===== Cache System =====

/**
 * Cache utilities for file management
 *
 * @example
 * import { writeToCache, getCachePath } from 'org-press';
 *
 * const cachePath = getCachePath(orgFilePath, 'js', blockIndex, cacheDir);
 * await writeToCache(cachePath, code);
 */
export {
  writeToCache,
  readFromCache,
  getCachePath,
  clearCache,
  cacheFileExists,
  ensureCacheDir,
  // Server result caching
  cacheServerResult,
  readCachedServerResult,
  invalidateServerResultCache,
} from "./cache.ts";

// ===== DTS Generation =====

/**
 * DTS (Declaration Type System) generation for org code blocks
 *
 * Provides TypeScript declaration file generation for code blocks
 * inside org files. Enables IDE features like completion, hover,
 * and diagnostics.
 *
 * @example
 * ```typescript
 * import { DtsGenerator, generateBlockManifest } from 'org-press';
 *
 * // Generate DTS files
 * const generator = new DtsGenerator({
 *   contentDir: 'content',
 *   outDir: 'dist/types',
 * });
 * await generator.loadBlocks();
 * await generator.writeDeclarations();
 *
 * // Or just create a manifest
 * const manifest = await generateBlockManifest('content');
 * ```
 */
export {
  // DTS Generator
  DtsGenerator,
  // Manifest generation
  extractBlocksFromFile,
  generateBlockManifest,
  filterTsJsBlocks,
  isTsJsLanguage,
  TS_JS_LANGUAGES,
  EXTENSION_MAP,
  // Position mapping
  orgToBlock,
  blockToOrg,
  mapRangeToOrg,
  mapRangeToBlock,
  mapLocationToOrg,
  offsetToPosition,
  positionToOffset,
  isInsideBlock,
  getBlockAtLine,
} from "./dts/index.ts";

export type {
  // Block types
  BlockInfo,
  BlockManifest,
  // Position types
  Position as DtsPosition,
  Range as DtsRange,
  Location as DtsLocation,
  OrgToBlockResult,
  BlockToOrgResult,
  // Generator types
  DtsGeneratorOptions,
  DtsGenerationResult,
  SerializableBlockInfo,
  SerializableManifest,
} from "./dts/index.ts";

// ===== Tool Configuration =====

/**
 * Configuration loader for development tools (formatter, linter, type-checker)
 */
export {
  loadToolConfig,
  clearConfigCache as clearToolConfigCache,
  invalidateToolConfigCache,
  getParserForLanguage,
  getExtensionForLanguage,
  isFormattableLanguage,
  isLintableLanguage,
  getFormatterOptions,
  getLinterOptions,
} from "./cli/config-loader.ts";

export type {
  ToolConfig,
  PrettierConfig,
  ESLintConfig,
  EditorConfig,
  EditorConfigSection,
  TSConfig,
  FormatterOptions,
  LinterOptions,
} from "./cli/config-loader.ts";

// ===== Format Command =====

/**
 * Format code blocks in org files using Prettier
 *
 * @example
 * import { formatOrgFiles, collectBlocks } from 'org-press';
 *
 * // Format all blocks in content directory
 * const summary = await formatOrgFiles({
 *   contentDir: 'content',
 *   projectRoot: process.cwd(),
 * });
 *
 * // Check only (exit 1 if changes needed)
 * const summary = await formatOrgFiles({
 *   check: true,
 *   contentDir: 'content',
 * });
 */
export {
  formatOrgFiles,
  collectBlocks,
  runFmt,
} from "./cli/commands/fmt.ts";

export type {
  FormatOptions,
  FormatResult,
  FormatSummary,
  CollectedBlock,
} from "./cli/commands/fmt.ts";

// ===== Lint Command =====

/**
 * Lint code blocks in org files using ESLint
 *
 * @example
 * import { lintOrgFiles } from 'org-press';
 *
 * // Lint all blocks in content directory
 * const summary = await lintOrgFiles({
 *   contentDir: 'content',
 *   projectRoot: process.cwd(),
 * });
 *
 * // Auto-fix problems
 * const summary = await lintOrgFiles({
 *   fix: true,
 *   contentDir: 'content',
 * });
 */
export {
  lintOrgFiles,
  runLint,
} from "./cli/commands/lint.ts";

export type {
  LintOptions,
  LintMessage,
  LintResult,
  LintSummary,
} from "./cli/commands/lint.ts";

// ===== Type-Check Command =====

/**
 * Type-check TypeScript code blocks in org files
 *
 * @example
 * import { typeCheckOrgFiles } from 'org-press';
 *
 * // Type-check all blocks in content directory
 * const summary = await typeCheckOrgFiles({
 *   contentDir: 'content',
 *   projectRoot: process.cwd(),
 * });
 *
 * // Watch mode
 * await typeCheckOrgFiles({
 *   watch: true,
 *   contentDir: 'content',
 * });
 */
export {
  typeCheckOrgFiles,
  runTypeCheck,
  isTypeCheckableLanguage,
} from "./cli/commands/type-check.ts";

export type {
  TypeCheckOptions,
  TypeCheckDiagnostic,
  TypeCheckResult,
  TypeCheckSummary,
} from "./cli/commands/type-check.ts";

// ===== Target Resolution =====

/**
 * CLI target resolution for files, directories, and globs
 *
 * @example
 * import { resolveTarget, formatTarget } from 'org-press';
 *
 * // Resolve a file
 * const result = await resolveTarget('content/page.org');
 *
 * // Resolve a directory
 * const result = await resolveTarget('content');
 *
 * // Resolve a glob pattern
 * const result = await resolveTarget('**\/*.org');
 */
export {
  getTargetType,
  hasGlobPattern,
  resolveTarget,
  formatTarget,
} from "./cli/target.ts";

export type { TargetType, ResolvedTarget } from "./cli/target.ts";

// ===== Version =====

/**
 * Org-Press version
 */
export const version = "2.0.0-alpha";

// Import functions needed for default export
import { orgPress as _orgPress } from "./node/vite-plugin-org-press.ts";
import { loadConfig as _loadConfig } from "./config/loader.ts";
import { loadPlugins as _loadPlugins } from "./plugins/loader.ts";
import { build as _build } from "./node/build/build.ts";

/**
 * @deprecated Use named exports instead
 *
 * This default export is provided for backwards compatibility but will be
 * removed in a future version. Use named exports instead:
 *
 * ```typescript
 * import { orgPress, loadConfig } from 'org-press';
 * ```
 */
export default {
  version,
  orgPress: _orgPress,
  loadConfig: _loadConfig,
  loadPlugins: _loadPlugins,
  build: _build,
};
