import type { OrgData, SrcBlock } from "uniorg";
import path from "node:path";
import type {
  ParseContext,
  VirtualModule,
  CacheFile,
  ParsedCodeBlock,
  CollectedBlock,
  BlockParameters,
} from "./types.ts";
import {
  parseCodeBlockParameters,
  isServerBlock,
  isApiBlock,
  shouldExportBlock,
  shouldShowSource,
} from "./parameters.ts";
import type { DrawerNode, CodeBlock } from "../plugins/types.ts";
import type { PluginContextImpl } from "../plugins/context.ts";
import type { TransformContext, BlockTransformContext } from "../plugins/types.ts";
import { getPluginContext } from "../plugins/plugin-init.ts";
import {
  createBlockId,
  createVirtualModuleId,
  rewriteOrgImports,
} from "../plugins/utils.ts";
import {
  renderChildrenToHtml,
  extractDrawerProperties,
} from "../render/ast-to-html.ts";
import { writeToCache, getCachePath } from "../cache.ts";
import { executeServerBlock, type ContentHelpers } from "./execute.ts";
import * as fs from "node:fs";
import { parsePipe } from "../plugins/pipe-parser.ts";
import { composeWrappersSync, globalRegistry } from "../plugins/wrapper-compose.ts";
import type { BlockContext, RenderFunction } from "../plugins/preview.ts";
import { initializeRenderApi } from "../plugins/preview-init.ts";

/**
 * Check if transformed code has exports that make it eligible for hydration.
 *
 * A block needs hydration if it has:
 * - A default export (dom mode: `export default ...`)
 * - A render export (react/dom mode: `export function render(...)`)
 *
 * Library blocks with only named exports (no default/render) are skipped
 * since they're imported by other blocks, not mounted directly.
 */
export function hasHydratableExports(code: string): boolean {
  // Check for default export
  const hasDefaultExport =
    code.includes("export default") ||
    code.includes("export{default") ||
    code.includes("export { default");

  // Check for render export
  const hasRenderExport =
    /export\s+(async\s+)?function\s+render\b/.test(code) ||
    /export\s+const\s+render\b/.test(code) ||
    /export\s*\{[^}]*\brender\b/.test(code);

  return hasDefaultExport || hasRenderExport;
}

/**
 * Determine the mode from the :use parameter
 *
 * Extracts the mode name from the :use parameter. The default mode is 'dom'.
 * Mode is the first segment before any pipe (wrapper) character.
 *
 * @param params - Block parameters
 * @returns Mode name (e.g., "dom", "react", "server")
 *
 * @example
 * determineMode({ use: "react" }) // "react"
 * determineMode({ use: "dom | withSourceCode" }) // "dom"
 * determineMode({ use: "preview" }) // "dom" (preview maps to dom)
 * determineMode({}) // "dom" (default)
 */
function determineMode(params: BlockParameters): string {
  const useValue = params.use || "dom";
  const mode = useValue.split("|")[0].trim();

  // Map legacy "preview" to "dom"
  if (mode === "preview") {
    return "dom";
  }

  return mode;
}

/**
 * Extract static HTML from code for pre-rendering
 *
 * Looks for common patterns:
 * - `export const html = \`...\``
 * - `.innerHTML = \`...\``
 * - `export default \`...\`` (for string exports)
 *
 * @param code - The transformed code content
 * @returns Extracted HTML string or null if not found
 */
function extractStaticHtml(code: string): string | null {
  // Pattern 1: export const html = `...`
  const htmlExportMatch = code.match(/export\s+const\s+html\s*=\s*`([\s\S]*?)`\s*;?/);
  if (htmlExportMatch) {
    return htmlExportMatch[1];
  }

  // Pattern 2: .innerHTML = `...` (common pattern for DOM-based blocks)
  const innerHtmlMatch = code.match(/\.innerHTML\s*=\s*`([\s\S]*?)`\s*;/);
  if (innerHtmlMatch) {
    return innerHtmlMatch[1];
  }

  // Pattern 3: export default `...` (direct HTML string export)
  const defaultExportMatch = code.match(/export\s+default\s+`([\s\S]*?)`\s*;?$/m);
  if (defaultExportMatch) {
    return defaultExportMatch[1];
  }

  return null;
}

/**
 * Build BlockContext for wrapper composition
 *
 * Creates the context object that wrappers use to access block metadata
 * like source code, language, parameters, etc.
 */
function buildBlockContext(
  block: ParsedCodeBlock,
  context: ParseContext
): BlockContext {
  // Filter out undefined values from parameters
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(block.parameters)) {
    if (value !== undefined) {
      params[key] = value;
    }
  }

  return {
    file: {
      path: context.orgFilePath,
      absolute: path.resolve(context.contentDir, context.orgFilePath),
    },
    block: {
      content: block.value,
      language: block.language,
      name: block.name,
      params,
      index: block.index,
    },
    runtime: {
      isDev: context.mode === "development",
      baseUrl: context.base,
    },
  };
}

/**
 * Apply wrappers from :use parameter to HTML content
 *
 * Parses the pipe syntax (e.g., `:use echarts | withTabs`) and applies
 * each wrapper to wrap the base HTML content.
 *
 * @param html - Base HTML content to wrap
 * @param useValue - The :use parameter value
 * @param blockContext - Block context for wrappers
 * @returns Wrapped HTML string
 */
function applyWrappers(
  html: string,
  useValue: string,
  blockContext: BlockContext
): string {
  const segments = parsePipe(useValue);

  // No wrappers to apply (only mode segment)
  if (segments.length <= 1) {
    return html;
  }

  // Ensure wrappers are registered (may be called before build initialization)
  initializeRenderApi();

  // Create base render function that returns the container HTML
  const baseRender: RenderFunction = () => html;

  // Compose wrappers and apply
  const composedRender = composeWrappersSync(segments, {
    registry: globalRegistry,
    baseRender,
    onUnknownWrapper: (name) => {
      console.warn(`[exporter] Unknown wrapper: ${name}`);
    },
  });

  // Execute the composed render function
  const result = composedRender(null, blockContext);

  // Handle result type (string or JSX.Element)
  if (typeof result === "string") {
    return result;
  }

  // For JSX elements, we'd need to render them - but for now wrappers return strings
  // This is a fallback that shouldn't normally be hit
  return html;
}

/**
 * AST Exporter
 *
 * Transforms org-mode AST by processing code blocks with plugins.
 * This is the core transformation layer - pure functions with injected dependencies.
 *
 * Key responsibilities:
 * - Find and parse code blocks
 * - Match blocks to plugins
 * - Apply plugin transformations
 * - Generate virtual modules
 * - Handle server-side execution
 * - Handle code/result display via :use parameter
 */

/**
 * Check if a block has a handler via plugin context
 *
 * Matching priority:
 * 1. Check :use parameter - look up handler by the mode/plugin name
 * 2. Fall back to language-based matching
 *
 * @param block - The code block to match
 * @param pluginContext - plugin context
 * @returns Handler name if found, null otherwise
 */
function findBlockHandler(
  block: CodeBlock,
  pluginContext: PluginContextImpl | undefined
): string | null {
  if (!pluginContext) {
    return null;
  }

  // Parse :use parameter to get the mode/plugin name
  const useMatch = block.meta?.match(/:use\s+(\w+)/);
  const useName = useMatch?.[1];

  if (useName) {
    // Try to find a block handler by the :use name
    const handler = pluginContext.getBlockHandler(useName);
    if (handler) {
      return useName;
    }

    // Try to find a transformer by the :use name
    const transformer = pluginContext.getTransformer(useName);
    if (transformer && transformer.onBuild) {
      return useName;
    }
  }

  // Try language-based lookup in context
  const langHandler = pluginContext.getBlockHandler(block.language);
  if (langHandler) {
    return block.language;
  }

  return null;
}

/**
 * Process all org-mode elements (code blocks and drawers) in a single AST walk
 *
 * This is the main entry point for AST transformation.
 * Walks the AST once, finding both code blocks and drawers,
 * and processes them using the plugin system.
 *
 * @param ast - Org-mode AST from uniorg parser
 * @param context - Parse context with injected dependencies
 * @param contentHelpers - Content helpers for server execution
 * @returns Arrays of generated virtual modules, cache files, and modified AST
 */
export async function processOrgElements(
  ast: OrgData,
  context: ParseContext,
  contentHelpers?: ContentHelpers
): Promise<{
  virtualModules: VirtualModule[];
  cacheFiles: CacheFile[];
  collectedBlocks: CollectedBlock[];
  modifiedAst: OrgData;
}> {
  const virtualModules: VirtualModule[] = [];
  const cacheFiles: CacheFile[] = [];
  const collectedBlocks: CollectedBlock[] = [];

  // Get plugin context (set by vite-plugin-org-press)
  const pluginContext = getPluginContext();
  if (!pluginContext) {
    console.warn(
      "[org-press] Plugin context not initialized. Code blocks will not be processed.\n" +
      "  Ensure initPluginContext() is called before parsing."
    );
  }

  // Track block index across entire document
  let blockIndex = 0;

  // Collect nodes to remove (blocks with :use silent)
  const nodesToRemove = new Set<any>();

  // Collect node replacements
  const nodeReplacements = new Map<any, any[]>();

  // Get dynamic drawer matchers (already sorted by priority)
  const dynamicDrawerMatchers = pluginContext?.getDynamicDrawerMatchers() || [];

  // Single AST walk for all elements
  await walkAst(ast, async (node: any) => {
    // Handle src-block nodes
    if (node.type === "src-block") {
      const srcBlock = node as any;

      // Parse block parameters
      const params = parseCodeBlockParameters(srcBlock.parameters);

      // Mark blocks with :use silent for removal
      if (!shouldExportBlock(params)) {
        nodesToRemove.add(node);
        blockIndex++;
        return;
      }

      // Extract name from affiliated keywords
      const blockName = (node as any).affiliated?.NAME as string | undefined;

      // Create parsed code block
      const parsedBlock: ParsedCodeBlock = {
        language: srcBlock.language || "",
        value: srcBlock.value || "",
        meta: srcBlock.parameters,
        parameters: params,
        index: blockIndex,
        name: blockName,
      };

      // Find handler via plugin context
      const handlerName = findBlockHandler(
        {
          language: parsedBlock.language,
          value: parsedBlock.value,
          meta: parsedBlock.meta,
        },
        pluginContext
      );

      if (handlerName) {
        // Handle server-side execution
        if (isServerBlock(params) && contentHelpers) {
          const replacement = await processServerBlock(
            parsedBlock,
            context,
            contentHelpers,
            virtualModules,
            cacheFiles,
            node
          );
          if (replacement) {
            nodeReplacements.set(node, replacement);
          }
        } else {
          // Client-side transformation
          const replacement = await processClientBlock(
            parsedBlock,
            handlerName,
            pluginContext!,
            context,
            virtualModules,
            cacheFiles,
            collectedBlocks,
            node
          );
          if (replacement) {
            nodeReplacements.set(node, replacement);
          }
        }
      }

      blockIndex++;
      return;
    }

    // Handle drawer nodes
    if (node.type === "drawer" && pluginContext) {
      // Extract properties from drawer children
      const properties = extractDrawerProperties(node.children);

      // Render children to HTML
      const childrenHtml = renderChildrenToHtml(node.children, { excludeProperties: true });

      const drawerNode: DrawerNode = {
        name: node.name,
        children: node.children,
        html: childrenHtml,
        properties,
      };

      // Create transform context
      const transformCtx: TransformContext = {
        orgFilePath: context.orgFilePath,
        config: (context.config || {}) as unknown as TransformContext["config"],
        base: context.base,
      };

      // Check dynamic matchers first (already sorted by priority)
      for (const matcher of dynamicDrawerMatchers) {
        if (matcher.matches(drawerNode)) {
          const result = await matcher.handler(drawerNode, transformCtx);
          if (result !== null) {
            nodeReplacements.set(node, [
              {
                type: "export-block",
                backend: "html",
                commented: false,
                value: result,
              },
            ]);
          }
          return; // Stop after first match
        }
      }

      // Check fixed name handlers
      const drawerHandler = pluginContext.getDrawerHandler(node.name);
      if (drawerHandler) {
        const result = await drawerHandler(drawerNode, transformCtx);
        if (result !== null) {
          nodeReplacements.set(node, [
            {
              type: "export-block",
              backend: "html",
              commented: false,
              value: result,
            },
          ]);
        }
      }
    }
  });

  // Apply node replacements
  if (nodeReplacements.size > 0) {
    replaceNodesInAst(ast, nodeReplacements);
  }

  // Remove marked nodes from AST
  if (nodesToRemove.size > 0) {
    removeNodesFromAst(ast, nodesToRemove);
  }

  return {
    virtualModules,
    cacheFiles,
    collectedBlocks,
    modifiedAst: ast,
  };
}

/**
 * Process org-mode AST and generate virtual modules
 *
 * @deprecated Use processOrgElements instead for single AST walk.
 * This function is kept for backward compatibility.
 *
 * @param ast - Org-mode AST from uniorg parser
 * @param context - Parse context with injected dependencies
 * @param contentHelpers - Content helpers for server execution
 * @returns Arrays of generated virtual modules and cache files
 */
export async function processCodeBlocks(
  ast: OrgData,
  context: ParseContext,
  contentHelpers?: ContentHelpers
): Promise<{
  virtualModules: VirtualModule[];
  cacheFiles: CacheFile[];
  collectedBlocks: CollectedBlock[];
  modifiedAst: OrgData;
}> {
  const virtualModules: VirtualModule[] = [];
  const cacheFiles: CacheFile[] = [];
  const collectedBlocks: CollectedBlock[] = [];

  // Track block index across entire document
  let blockIndex = 0;

  // Collect nodes to remove (blocks with :use silent)
  const nodesToRemove = new Set<any>();

  // Collect node replacements (blocks with :use dom or withSourceCode wrapper)
  const nodeReplacements = new Map<any, any[]>();

  // Get plugin context from config (set by vite-plugin-org-press)
  const pluginContext = getPluginContext();
  if (!pluginContext) {
    console.warn(
      "[org-press] Plugin context not initialized. Code blocks will not be processed.\n" +
      "  Ensure initPluginContext() is called before parsing."
    );
  }

  // Walk AST and process code blocks
  await walkAst(ast, async (node: any) => {
    if (node.type !== "src-block") return;

    const srcBlock = node as any;  // Use any since uniorg types don't match

    // Parse block parameters (uniorg uses 'parameters', not 'meta')
    const params = parseCodeBlockParameters(srcBlock.parameters);

    // Mark blocks with :use silent for removal
    if (!shouldExportBlock(params)) {
      nodesToRemove.add(node);
      blockIndex++;
      return;
    }

    // Extract name from affiliated keywords (#+NAME: directive)
    const blockName = (node as any).affiliated?.NAME as string | undefined;

    // Create parsed code block
    const parsedBlock: ParsedCodeBlock = {
      language: srcBlock.language || "",
      value: srcBlock.value || "",
      meta: srcBlock.parameters,  // Store raw parameters string
      parameters: params,
      index: blockIndex,
      name: blockName,
    };

    // Find handler via plugin context
    const handlerName = findBlockHandler(
      {
        language: parsedBlock.language,
        value: parsedBlock.value,
        meta: parsedBlock.meta,  // Raw parameters string for plugin matching
      },
      pluginContext
    );

    if (handlerName) {
      // Handle server-side execution
      if (isServerBlock(params) && contentHelpers) {
        const replacement = await processServerBlock(
          parsedBlock,
          context,
          contentHelpers,
          virtualModules,
          cacheFiles,
          node
        );

        // If replacement nodes are provided, mark for replacement
        if (replacement) {
          nodeReplacements.set(node, replacement);
        }
      } else {
        // Client-side transformation
        const replacement = await processClientBlock(
          parsedBlock,
          handlerName,
          pluginContext!,
          context,
          virtualModules,
          cacheFiles,
          collectedBlocks,
          node
        );

        // If replacement nodes are provided, mark for replacement
        if (replacement) {
          nodeReplacements.set(node, replacement);
        }
      }
    }

    blockIndex++;
  });

  // Apply node replacements (for :use dom/withSourceCode)
  if (nodeReplacements.size > 0) {
    replaceNodesInAst(ast, nodeReplacements);
  }

  // Remove marked nodes from AST
  if (nodesToRemove.size > 0) {
    removeNodesFromAst(ast, nodesToRemove);
  }

  return {
    virtualModules,
    cacheFiles,
    collectedBlocks,
    modifiedAst: ast,
  };
}

/**
 * Process a server-side code block
 *
 * Executes the code on the server and replaces the block with the output.
 * Returns replacement nodes based on :use mode (preview, sourceOnly, etc.).
 */
async function processServerBlock(
  block: ParsedCodeBlock,
  context: ParseContext,
  contentHelpers: ContentHelpers,
  virtualModules: VirtualModule[],
  cacheFiles: CacheFile[],
  originalNode: any
): Promise<any[] | null> {
  // Execute server-side directly
  const result = await executeServerBlock(
    block.value,
    block.language,
    contentHelpers
  );

  if (result.error) {
    console.error(`Server execution error in ${context.orgFilePath}:`, result.error);
    // On error, keep the original node (show the code)
    return null;
  }

  // Determine display mode from :use parameter
  const showSource = shouldShowSource(block.parameters);
  const useValue = block.parameters.use || "preview";
  const mode = useValue.split("|")[0].trim();

  // sourceOnly mode: show code only, no results
  if (mode === "sourceOnly") {
    return null;
  }

  // Create replacement nodes based on mode and withSourceCode wrapper
  if (showSource) {
    // Show both code and results: keep src-block + add HTML output
    return [
      originalNode, // Keep the original src-block for code display
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: result.output,
      },
    ];
  } else {
    // Only show results: replace src-block with HTML output
    return [
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: result.output,
      },
    ];
  }
}

/**
 * Process a client-side code block
 *
 * Applies plugin transformation, writes to cache, and collects block info for manifest.
 * Returns a container div with data-org-block attribute for hydration.
 * No inline scripts - hydration is handled by a single hydrate.js script.
 */
async function processClientBlock(
  block: ParsedCodeBlock,
  handlerName: string,
  pluginContext: PluginContextImpl,
  context: ParseContext,
  virtualModules: VirtualModule[],
  cacheFiles: CacheFile[],
  collectedBlocks: CollectedBlock[],
  originalNode: any
): Promise<any[] | null> {
  // Skip server blocks - they should not be hydrated in the browser
  // During pre-parse, contentHelpers is not available so server blocks fall through here
  if (isServerBlock(block.parameters)) {
    return null;
  }

  // Skip API blocks - they define server-side endpoints and should not be hydrated
  if (isApiBlock(block.parameters)) {
    return null;
  }

  // Filter out undefined values from parameters to match Record<string, string>
  const filteredParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(block.parameters)) {
    if (value !== undefined) {
      filteredParams[key] = value;
    }
  }

  // Build BlockTransformContext
  const blockCtx: BlockTransformContext = {
    orgFilePath: context.orgFilePath,
    blockIndex: block.index,
    blockName: block.name,
    parameters: filteredParams,
    plugins: context.plugins as any,  // expects OrgPressPlugin[]
    config: (context.config || {}) as any,
    cacheDir: context.cacheDir,
    base: context.base,
    contentDir: context.contentDir,
    outDir: context.outDir,
    command: context.mode === "production" ? "build" : "serve",
  };

  // Get the handler and call it
  let transformResult: { code?: string; html?: string; script?: string; css?: string } | null = null;

  // Try block handler first
  const blockHandler = pluginContext.getBlockHandler(handlerName);
  if (blockHandler) {
    transformResult = await blockHandler(
      {
        language: block.language,
        value: block.value,
        meta: block.meta,
      },
      blockCtx
    );
  } else {
    // Try transformer handler
    const transformer = pluginContext.getTransformer(handlerName);
    if (transformer && transformer.onBuild) {
      const params = blockCtx.parameters || {};
      const input = {
        code: block.value,
        language: block.language,
        params,
        html: "",
        result: undefined,
      };
      const buildCtx = {
        id: `block-${blockCtx.blockIndex}`,
        code: block.value,
        orgFilePath: blockCtx.orgFilePath,
        blockIndex: blockCtx.blockIndex,
        blockName: blockCtx.blockName,
        params,
      };
      const output = await transformer.onBuild(input, buildCtx);
      transformResult = { code: output.script || "" };
    }
  }

  if (!transformResult) return null;

  // If no code in result, skip this block
  if (!transformResult.code) return null;

  // Rewrite .org imports to .html
  const code = rewriteOrgImports(transformResult.code, context.orgFilePath);

  // Determine extension based on language
  const EXTENSION_MAP: Record<string, string> = {
    javascript: "js", js: "js",
    typescript: "ts", ts: "ts",
    jsx: "jsx", tsx: "tsx",
  };
  const defaultExtension = EXTENSION_MAP[block.language.toLowerCase()] || "js";

  // Generate virtual module ID (still needed for dev mode)
  const moduleId = createVirtualModuleId(
    handlerName,
    context.orgFilePath,
    block.index,
    defaultExtension,
    block.name
  );

  // Add to virtual modules list
  virtualModules.push({
    id: moduleId,
    pluginName: handlerName,
    blockIndex: block.index,
    blockName: block.name,
    code,
    extension: defaultExtension,
  });

  // Write to cache for file-based execution
  // Determine extension based on output type:
  // - CSS languages: keep original extension (css, scss, sass, less)
  // - Executable languages: keep original extension (js, ts, tsx, jsx)
  // - Other languages (html, json, etc.): use default extension (usually 'js')
  const cssLanguages = ["css", "scss", "sass", "less"];
  const executableLanguages = ["javascript", "js", "typescript", "ts", "tsx", "jsx"];
  const lang = block.language.toLowerCase();
  const keepOriginalExtension = cssLanguages.includes(lang) || executableLanguages.includes(lang);
  const cacheExtension = keepOriginalExtension ? block.language : defaultExtension;
  const cachePath = getCachePath(
    context.orgFilePath,
    block.name,
    cacheExtension,
    block.value,
    context.cacheDir
  );

  await writeToCache(cachePath, code);

  cacheFiles.push({
    path: cachePath,
    code,
    language: block.language,
    blockName: block.name,
  });

  // Generate block ID for manifest and hydration
  const blockId = createBlockId(context.orgFilePath, block.index);
  const containerId = `org-block-${block.index}-result`;

  // Determine display mode from :use parameter
  const showSource = shouldShowSource(block.parameters);
  const useValue = block.parameters.use || "preview";
  const mode = useValue.split("|")[0].trim();

  // sourceOnly mode: show code only, no results
  if (mode === "sourceOnly") {
    return null;
  }

  // CSS blocks: inject as <style> tag (no hydration needed)
  if (block.language.toLowerCase() === "css") {
    const styleTag = `<style data-org-block="${blockId}">${code}</style>`;

    if (showSource) {
      return [
        originalNode,
        {
          type: "export-block",
          backend: "html",
          commented: false,
          value: styleTag,
        },
      ];
    } else {
      return [
        {
          type: "export-block",
          backend: "html",
          commented: false,
          value: styleTag,
        },
      ];
    }
  }

  // Determine the mode for this block
  const modeName = determineMode(block.parameters);

  // Collect block info for manifest (used by hydration system)
  collectedBlocks.push({
    id: blockId,
    containerId,
    cachePath,
    virtualModuleId: moduleId,
    name: block.name,
    language: block.language,
    modeName,
  });

  // Register with hydrate registry if available (for per-page hydrate entries)
  // Only register blocks that need hydration (have default or render exports).
  // Library blocks with only other named exports are skipped.
  if (hasHydratableExports(code)) {
    if (context.hydrateRegistry) {
      context.hydrateRegistry.addModule(context.orgFilePath, blockId, defaultExtension, cachePath, moduleId, modeName);
    } else if (context.mode === "production") {
      console.warn(
        `[org-press] Block "${blockId}" in ${context.orgFilePath} needs hydration but no HydrateRegistry was provided. ` +
        `This block will not be interactive in the built output.`
      );
    }
  }

  // Generate container div with data attribute for hydration
  // Note: Static HTML extraction (SSG) is disabled for now to avoid
  // duplicate rendering issues with hydration. The container starts empty
  // and is populated by client-side JavaScript.
  const containerDiv = `<div id="${containerId}" data-org-block="${blockId}" class="org-block-result"></div>`;

  // Apply wrappers from :use parameter (e.g., :use echarts | withTabs)
  // Wrappers transform the HTML output, adding tabs, source code panels, etc.
  const blockContext = buildBlockContext(block, context);
  const wrappedHtml = applyWrappers(containerDiv, useValue, blockContext);

  if (showSource) {
    // withSourceCode: show both code and results
    return [
      originalNode,
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: wrappedHtml,
      },
    ];
  } else {
    // preview: show results only
    return [
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: wrappedHtml,
      },
    ];
  }
}

/**
 * Process drawer nodes in the AST
 *
 * Walks the AST, finds drawer nodes, matches them to drawer plugins,
 * and transforms them to HTML using plugin system.
 *
 * Matching priority:
 * 1. Dynamic matchers (by priority, higher first) - matches based on properties/conditions
 * 2. Fixed name handlers - matches by exact drawer name
 *
 * @param ast - Org-mode AST from uniorg parser
 * @param context - Parse context
 * @returns Modified AST with drawers transformed
 */
export async function processDrawers(
  ast: OrgData,
  context: ParseContext
): Promise<OrgData> {
  // Get plugin context (set by vite-plugin-org-press)
  const pluginContext = getPluginContext();

  // If no context, nothing to do
  if (!pluginContext) {
    return ast;
  }

  // Get dynamic matchers (already sorted by priority)
  const dynamicMatchers = pluginContext.getDynamicDrawerMatchers();

  // Collect node replacements
  const nodeReplacements = new Map<any, any[]>();

  await walkAst(ast, async (node: any) => {
    if (node.type !== "drawer") return;

    // Extract properties from drawer children (using utility)
    const properties = extractDrawerProperties(node.children);

    // Render children to HTML, excluding property nodes (using utility)
    const childrenHtml = renderChildrenToHtml(node.children, { excludeProperties: true });

    const drawerNode: DrawerNode = {
      name: node.name,
      children: node.children,
      html: childrenHtml,
      properties,
    };

    // Create transform context
    // Cast config through unknown since config types have different index signatures
    const transformCtx: TransformContext = {
      orgFilePath: context.orgFilePath,
      config: (context.config || {}) as unknown as TransformContext["config"],
      base: context.base,
    };

    // 1. First check dynamic matchers (already sorted by priority desc)
    for (const matcher of dynamicMatchers) {
      if (matcher.matches(drawerNode)) {
        const result = await matcher.handler(drawerNode, transformCtx);
        if (result !== null) {
          nodeReplacements.set(node, [
            {
              type: "export-block",
              backend: "html",
              commented: false,
              value: result,
            },
          ]);
        }
        return; // Stop after first match
      }
    }

    // 2. Then check fixed name handlers
    const drawerHandler = pluginContext.getDrawerHandler(node.name);
    if (drawerHandler) {
      // Call handler
      const result = await drawerHandler(drawerNode, transformCtx);

      // If we got a result, add to replacements
      if (result !== null) {
        nodeReplacements.set(node, [
          {
            type: "export-block",
            backend: "html",
            commented: false,
            value: result,
          },
        ]);
      }
    }
  });

  if (nodeReplacements.size > 0) {
    replaceNodesInAst(ast, nodeReplacements);
  }

  return ast;
}

/**
 * Walk AST and call visitor function on each node
 *
 * Simple depth-first traversal of the AST.
 */
async function walkAst(
  node: any,
  visitor: (node: any) => Promise<void> | void
): Promise<void> {
  if (!node) return;

  // Visit current node
  await visitor(node);

  // Recurse on children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      await walkAst(child, visitor);
    }
  }
}

/**
 * Find all code blocks in an AST
 *
 * Utility function to extract all src-block nodes.
 *
 * @param ast - Org-mode AST
 * @returns Array of code blocks
 */
export function findCodeBlocks(ast: OrgData): SrcBlock[] {
  const blocks: SrcBlock[] = [];

  function walk(node: any) {
    if (!node) return;

    if (node.type === "src-block") {
      blocks.push(node as SrcBlock);
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Handle tangle operation (literate programming)
 *
 * Extracts code blocks to external files based on :tangle parameter.
 *
 * @param block - Parsed code block with :tangle parameter
 * @param context - Parse context
 */
export async function handleTangle(
  block: ParsedCodeBlock,
  context: ParseContext
): Promise<void> {
  if (!block.parameters.tangle) return;

  // Prevent tangle in browser
  if (typeof window !== "undefined") {
    console.warn("Tangle is not supported in browser environment");
    return;
  }

  const tanglePath = block.parameters.tangle;

  // Write block content to tangle file
  // For now, use simple file write - could be enhanced with:
  // - Appending multiple blocks to same file
  // - Debouncing writes
  // - Handling org-mode noweb syntax
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const fullPath = path.join(process.cwd(), tanglePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, block.value, "utf-8");
}

/**
 * Remove nodes from AST
 *
 * @param ast - Root AST node
 * @param nodesToRemove - Set of nodes to remove
 */
function removeNodesFromAst(ast: any, nodesToRemove: Set<any>): void {
  function walk(node: any): void {
    if (!node || !node.children || !Array.isArray(node.children)) return;

    // Filter out nodes marked for removal
    node.children = node.children.filter((child: any) => !nodesToRemove.has(child));

    // Recurse on remaining children
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(ast);
}

/**
 * Replace nodes in AST with replacement nodes
 *
 * @param ast - Root AST node
 * @param nodeReplacements - Map of nodes to their replacements
 */
function replaceNodesInAst(
  ast: any,
  nodeReplacements: Map<any, any[]>
): void {
  function walk(node: any): void {
    if (!node || !node.children || !Array.isArray(node.children)) return;

    const newChildren: any[] = [];

    for (const child of node.children) {
      if (nodeReplacements.has(child)) {
        // Replace with the replacement nodes
        const replacements = nodeReplacements.get(child)!;
        newChildren.push(...replacements);
      } else {
        // Keep the original child
        newChildren.push(child);
        // Recurse on this child
        walk(child);
      }
    }

    node.children = newChildren;
  }

  walk(ast);
}
