import type { OrgData, SrcBlock } from "uniorg";
import path from "node:path";
import type {
  ParseContext,
  VirtualModule,
  CacheFile,
  ParsedCodeBlock,
  CollectedBlock,
} from "./types.ts";
import {
  parseCodeBlockParameters,
  isServerBlock,
  shouldExportBlock,
  shouldShowSource,
} from "./parameters.ts";
import { findMatchingPlugin } from "../plugins/loader.ts";
import {
  createBlockId,
  createVirtualModuleId,
  rewriteOrgImports,
} from "../plugins/utils.ts";
import { writeToCache, getCachePath } from "../cache.ts";
import { executeServerBlock, type ContentHelpers } from "./execute.ts";

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
 * Process org-mode AST and generate virtual modules
 *
 * This is the main entry point for AST transformation.
 * Walks the AST, finds code blocks, matches them to plugins,
 * and generates virtual modules.
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

  // Collect node replacements (blocks with :use preview or withSourceCode wrapper)
  const nodeReplacements = new Map<any, any[]>();

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

    // Find matching plugin
    const plugin = findMatchingPlugin(context.plugins, {
      language: parsedBlock.language,
      value: parsedBlock.value,
      meta: parsedBlock.meta,  // Raw parameters string for plugin matching
    });

    if (plugin) {
      parsedBlock.plugin = plugin;

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
          plugin,
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

  // Apply node replacements (for :use preview/withSourceCode)
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
 *
 * If the block has a matching plugin with onServer hook, uses the plugin's
 * execution (which may include caching and custom handlers).
 * Otherwise falls back to direct executeServerBlock call.
 */
async function processServerBlock(
  block: ParsedCodeBlock,
  context: ParseContext,
  contentHelpers: ContentHelpers,
  virtualModules: VirtualModule[],
  cacheFiles: CacheFile[],
  originalNode: any
): Promise<any[] | null> {
  let result: { output: string; error?: Error };

  // Try to use plugin's onServer hook if available
  // This enables the new handler-based execution with caching
  if (block.plugin?.onServer) {
    // Filter out undefined values from parameters to match Record<string, string>
    const filteredParameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(block.parameters)) {
      if (value !== undefined) {
        filteredParameters[key] = value;
      }
    }

    // Build transform context with contentHelpers
    const transformContext = {
      orgFilePath: context.orgFilePath,
      blockIndex: block.index,
      blockName: block.name,
      parameters: filteredParameters,
      plugins: context.plugins,
      config: context.config || {},
      cacheDir: context.cacheDir,
      base: context.base,
      contentDir: context.contentDir,
      outDir: context.outDir,
      contentHelpers: contentHelpers,
    };

    const pluginResult = await block.plugin.onServer(
      {
        language: block.language,
        value: block.value,
        meta: block.meta,
      },
      transformContext
    );

    // The plugin's onServer returns { code, executeOnServer }
    // For HTML output, we use the code as the result
    // Note: In the new architecture, the plugin handles execution and returns
    // display code. For SSR, we still need the actual result.
    // For now, we execute via the legacy path to get the actual HTML output.
    result = await executeServerBlock(
      block.value,
      block.language,
      contentHelpers
    );
  } else {
    // Fallback: Execute server-side directly
    result = await executeServerBlock(
      block.value,
      block.language,
      contentHelpers
    );
  }

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
  plugin: any,
  context: ParseContext,
  virtualModules: VirtualModule[],
  cacheFiles: CacheFile[],
  collectedBlocks: CollectedBlock[],
  originalNode: any
): Promise<any[] | null> {
  // Filter out undefined values from parameters to match Record<string, string>
  const filteredParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(block.parameters)) {
    if (value !== undefined) {
      filteredParams[key] = value;
    }
  }

  // Call plugin transform
  const transformResult = await plugin.transform?.(
    {
      language: block.language,
      value: block.value,
      meta: block.meta,
    },
    {
      orgFilePath: context.orgFilePath,
      blockIndex: block.index,
      blockName: block.name,
      parameters: filteredParams,
      cacheDir: context.cacheDir,
      base: context.base,
      contentDir: context.contentDir,
      outDir: context.outDir,
    }
  );

  if (!transformResult) return null;

  // Rewrite .org imports to .html
  const code = rewriteOrgImports(transformResult.code, context.orgFilePath);

  // Generate virtual module ID (still needed for dev mode)
  const moduleId = createVirtualModuleId(
    plugin.name,
    context.orgFilePath,
    block.index,
    plugin.defaultExtension,
    block.name
  );

  // Add to virtual modules list
  virtualModules.push({
    id: moduleId,
    pluginName: plugin.name,
    blockIndex: block.index,
    blockName: block.name,
    code,
    extension: plugin.defaultExtension,
  });

  // Write to cache for file-based execution
  const cachePath = getCachePath(
    context.orgFilePath,
    block.name,
    block.language,
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
  if (plugin.defaultExtension === "css") {
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

  // Collect block info for manifest (used by hydration system)
  collectedBlocks.push({
    id: blockId,
    containerId,
    cachePath,
    name: block.name,
    language: block.language,
  });

  // Generate container div with data attribute for hydration
  // No inline script - the hydrate.js script will handle all blocks
  const containerDiv = `<div id="${containerId}" data-org-block="${blockId}" class="org-block-result"></div>`;

  if (showSource) {
    // withSourceCode: show both code and results
    return [
      originalNode,
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: containerDiv,
      },
    ];
  } else {
    // preview: show results only
    return [
      {
        type: "export-block",
        backend: "html",
        commented: false,
        value: containerDiv,
      },
    ];
  }
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
