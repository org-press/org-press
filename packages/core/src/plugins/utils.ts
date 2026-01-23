/**
 * Shared utility functions for org-press plugins
 *
 * This module provides a single source of truth for common operations like:
 * - Block ID generation
 * - Import rewriting
 * - Parameter parsing
 * - Virtual module ID creation
 *
 * Eliminates code duplication across plugins and core modules.
 */

/**
 * Generate stable block ID used across server and client
 *
 * Creates a deterministic ID from the org file path and block index.
 * This ensures the same block always has the same ID, which is critical for:
 * - HMR (Hot Module Replacement)
 * - Client-side block mounting (finding the correct container)
 * - Cache file paths
 *
 * @param orgFilePath - Relative path to .org file (e.g., "content/index.org")
 * @param blockIndex - 0-based index of block in file
 * @returns Stable ID (e.g., "block-content-index-org-0")
 *
 * @example
 * createBlockId("content/blog/post.org", 0)
 * // Returns: "block-content-blog-post-org-0"
 *
 * createBlockId("docs/api.org", 5)
 * // Returns: "block-docs-api-org-5"
 */
export function createBlockId(orgFilePath: string, blockIndex: number): string {
  const sanitized = orgFilePath.replace(/[^a-z0-9]/gi, "-");
  return `block-${sanitized}-${blockIndex}`;
}

/**
 * Rewrite .org imports to .html for browser compatibility
 *
 * When code blocks import from other .org files, we need to rewrite those
 * imports to point to the generated .html files (or directories) instead.
 *
 * Handles:
 * - Relative imports: "./other.org" → "./other.html"
 * - Preserves imports with query params: "./lib.org?name=foo" stays unchanged
 *   (these are virtual module imports handled by the virtual-blocks plugin)
 * - Preserves non-.org imports unchanged
 *
 * @param code - Source code potentially containing .org imports
 * @param currentFilePath - Path of current .org file (for context)
 * @returns Code with rewritten imports
 *
 * @example
 * rewriteOrgImports('import foo from "./other.org"', 'content/index.org')
 * // Returns: 'import foo from "./other.html"'
 *
 * rewriteOrgImports('import { bar } from "./lib.org?name=util"', 'content/post.org')
 * // Returns: 'import { bar } from "./lib.org?name=util"' (unchanged - virtual module)
 */
export function rewriteOrgImports(
  code: string,
  currentFilePath: string
): string {
  // Match: from "..." or from '...'
  // Capture the import path including .org extension
  return code.replace(
    /from\s+(['"])([^'"]+\.org(?:\?[^'"]*)?)\1/g,
    (match, quote, importPath) => {
      // Don't rewrite imports with query params - these are virtual module imports
      // that should be resolved by the virtual-blocks plugin (e.g., ./file.org?name=foo)
      if (importPath.includes("?")) {
        return match;
      }
      // Replace .org with .html for plain file imports
      const htmlPath = importPath.replace(/\.org$/, ".html");
      return `from ${quote}${htmlPath}${quote}`;
    }
  );
}

/**
 * Parse org-mode block parameters into key-value map
 *
 * Org-mode blocks can have parameters like:
 *   #+begin_src javascript :use preview | withSourceCode :height 400px
 *
 * This function extracts them into an object:
 *   { use: "preview | withSourceCode", height: "400px" }
 *
 * Also supports flag parameters (no value):
 *   #+begin_src javascript :exec
 *   // Returns: { exec: "" }
 *
 * @param meta - Block meta string (everything after the language name)
 * @returns Parsed parameters as key-value object
 *
 * @example
 * parseBlockParameters(":use preview | withSourceCode :height 400px")
 * // Returns: { use: "preview | withSourceCode", height: "400px" }
 *
 * parseBlockParameters(":use server | json :height 600px")
 * // Returns: { use: "server | json", height: "600px" }
 *
 * parseBlockParameters(":exec")
 * // Returns: { exec: "" }
 *
 * parseBlockParameters(null)
 * // Returns: {}
 */
export function parseBlockParameters(
  meta: string | null | undefined
): Record<string, string> {
  if (!meta) return {};

  const params: Record<string, string> = {};

  // Match :key value patterns
  // The value can be any non-whitespace, non-colon sequence
  const keyValueRegex = /:(\w+)\s+([^\s:]+)/g;
  let match;

  while ((match = keyValueRegex.exec(meta)) !== null) {
    const [, key, value] = match;
    params[key] = value;
  }

  // Also match :key flags (parameters without values)
  // These are :key followed by end of string, another :key, or only whitespace
  const flagRegex = /:(\w+)(?=\s*$|\s*:|\s+(?![^\s:]))/g;
  while ((match = flagRegex.exec(meta)) !== null) {
    const [, key] = match;
    // Only add if not already set by key-value pattern
    if (!(key in params)) {
      params[key] = "";
    }
  }

  return params;
}

/**
 * Check if block should use a specific plugin based on :use parameter
 *
 * The :use parameter explicitly selects a plugin, overriding language-based matching.
 * Example: :use jscad tells the system to use the jscad plugin regardless of language.
 *
 * @param meta - Block meta string
 * @param pluginName - Plugin name to check
 * @returns True if block specifies :use pluginName
 *
 * @example
 * usesPlugin(":use jscad | withSourceCode", "jscad")
 * // Returns: true
 *
 * usesPlugin(":height 400px", "jscad")
 * // Returns: false
 *
 * usesPlugin(":use excalidraw :height 400px", "excalidraw")
 * // Returns: true
 */
export function usesPlugin(
  meta: string | null | undefined,
  pluginName: string
): boolean {
  if (!meta) return false;

  const useMatch = meta.match(/:use\s+(\w+)/);
  return useMatch?.[1] === pluginName;
}

/**
 * Generate virtual module ID for a block
 *
 * Virtual modules are Vite's way of creating modules that don't exist as files.
 * We use them for code blocks, allowing proper module resolution and HMR.
 *
 * Format: virtual:org-press:block:{plugin}:{path}:{index}.{ext}
 * For named blocks: virtual:org-press:block:{plugin}:{path}:NAME:{name}.{ext}
 *
 * @param pluginName - Plugin handling the block (e.g., "jscad", "javascript")
 * @param orgFilePath - Path to .org file
 * @param blockIndex - Block index (or "NAME" for named blocks)
 * @param extension - File extension (js, css, tsx, etc.)
 * @param blockName - Optional named block identifier
 * @returns Virtual module ID
 *
 * @example
 * createVirtualModuleId("javascript", "content/post.org", 0, "js")
 * // Returns: "virtual:org-press:block:javascript:content/post.org:0.js"
 *
 * createVirtualModuleId("jscad", "content/3d.org", 2, "js")
 * // Returns: "virtual:org-press:block:jscad:content/3d.org:2.js"
 *
 * createVirtualModuleId("javascript", "lib/utils.org", 0, "js", "helper")
 * // Returns: "virtual:org-press:block:javascript:lib/utils.org:NAME:helper.js"
 */
export function createVirtualModuleId(
  pluginName: string,
  orgFilePath: string,
  blockIndex: number,
  extension: string = "js",
  blockName?: string
): string {
  const indexPart = blockName ? `NAME:${blockName}` : blockIndex;
  return `virtual:org-press:block:${pluginName}:${orgFilePath}:${indexPart}.${extension}`;
}

/**
 * Parse virtual module ID back into components
 *
 * Reverse operation of createVirtualModuleId.
 * Used by the virtual blocks Vite plugin to understand which block to load.
 *
 * @param virtualId - Virtual module ID (without \0 prefix)
 * @returns Parsed components or null if not a valid virtual module ID
 *
 * @example
 * parseVirtualModuleId("virtual:org-press:block:jscad:content/3d.org:2.js")
 * // Returns: { pluginName: "jscad", orgFilePath: "content/3d.org", blockIndex: 2, extension: "js" }
 *
 * parseVirtualModuleId("virtual:org-press:block:javascript:lib.org:NAME:util.js")
 * // Returns: { pluginName: "javascript", orgFilePath: "lib.org", blockName: "util", extension: "js" }
 */
export function parseVirtualModuleId(virtualId: string): {
  pluginName: string;
  orgFilePath: string;
  blockIndex?: number;
  blockName?: string;
  extension: string;
} | null {
  // Remove potential \0 prefix
  const id = virtualId.replace(/^\0/, "");

  // Match pattern: virtual:org-press:block:{plugin}:{path}:{index|NAME:name}.{ext}
  const match = id.match(
    /^virtual:org-press:block:([^:]+):(.+):(?:NAME:([^.]+)|(\d+))\.(\w+)$/
  );

  if (!match) return null;

  const [, pluginName, orgFilePath, blockName, blockIndexStr, extension] =
    match;

  return {
    pluginName,
    orgFilePath,
    ...(blockName ? { blockName } : { blockIndex: parseInt(blockIndexStr, 10) }),
    extension,
  };
}

