/**
 * HydrateRegistry - Tracks blocks during pre-parse and generates hydrate entry files
 *
 * This registry collects information about blocks that need hydration across all pages,
 * then generates entry files that can be used as client build inputs.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Block entry tracked by the registry
 */
export interface BlockEntry {
  /** Block identifier, e.g., "block-content-index-org-8" */
  blockId: string;
  /** File extension, e.g., "tsx", "ts", "js" */
  ext: string;
  /** Absolute path to cached file */
  cachePath: string;
  /** Virtual module ID for Vite resolution (e.g., "virtual:org-press:block:preview:content/index.org:0.tsx") */
  virtualModuleId: string;
  /** Mode name for rendering (e.g., "dom", "react") */
  modeName?: string;
}

/**
 * Sanitize an org path to a valid filename
 *
 * Converts path separators to dashes and removes the .org extension.
 *
 * @param orgPath - The org file path to sanitize
 * @returns Sanitized path suitable for use as a filename
 *
 * @example
 * sanitizePath("content/blog/post.org") // Returns: "content-blog-post"
 * sanitizePath("/absolute/path/to/file.org") // Returns: "absolute-path-to-file"
 */
export function sanitizePath(orgPath: string): string {
  let result = orgPath;

  // Convert absolute paths to relative to project root
  const cwd = process.cwd();
  if (path.isAbsolute(orgPath)) {
    result = path.relative(cwd, orgPath);
  }

  return (
    result
      // Remove .org extension
      .replace(/\.org$/i, "")
      // Normalize backslashes to forward slashes first
      .replace(/\\/g, "/")
      // Remove leading slashes or dots
      .replace(/^[./]+/, "")
      // Replace path separators with dashes
      .replace(/\//g, "-")
      // Replace multiple consecutive dashes with single dash
      .replace(/-+/g, "-")
      // Remove trailing dashes
      .replace(/-$/, "")
  );
}

/** Virtual module ID for the hydration runtime */
const HYDRATE_RUNTIME_ID = "org-press/client/hydrate-runtime";

/**
 * Generate a hydrate entry file content for a page
 *
 * Creates JavaScript code that imports all block modules and hydrates them
 * by finding their DOM elements and calling the exported functions.
 *
 * For production builds, uses static imports from virtual module IDs for tree-shaking.
 * The hydration checks for a `render` named export for custom rendering.
 *
 * @param orgPath - Original org file path (e.g., "content/index.org")
 * @param blocks - Blocks that need hydration on this page
 * @param cacheDir - Cache directory path (to compute relative imports)
 * @returns Entry file content as JavaScript code
 *
 * @example
 * // For content/index.org with one block:
 * generateHydrateEntry("content/index.org", [{
 *   blockId: "block-content-index-org-8",
 *   ext: "ts",
 *   cachePath: "/abs/path/.org-press-cache/content/index/landing-controller.ts",
 *   virtualModuleId: "virtual:org-press:block:preview:content/index.org:8.ts"
 * }], "/abs/path/.org-press-cache")
 * // Returns JavaScript with static imports from virtual modules
 */
export function generateHydrateEntry(orgPath: string, blocks: BlockEntry[], cacheDir?: string): string {
  if (blocks.length === 0) {
    return `// Auto-generated hydrate entry for ${orgPath}\n// No blocks to hydrate\n`;
  }

  const lines: string[] = [];

  // Header comment
  lines.push(`// Auto-generated hydrate entry for ${orgPath}`);
  lines.push("");

  // Import hydration runtime
  lines.push(`import { initHydration } from "${HYDRATE_RUNTIME_ID}";`);
  lines.push("");

  // Static import statements using virtual module IDs
  blocks.forEach((block, index) => {
    const importPath = block.virtualModuleId || block.cachePath;
    lines.push(`import * as Block${index} from "${importPath}";`);
  });

  lines.push("");

  // Blocks registry
  lines.push("const blocks = {");
  blocks.forEach((block, index) => {
    const isReact = block.ext === "tsx" || block.ext === "jsx";
    const modeName = block.modeName || "dom";
    lines.push(`  "${block.blockId}": { module: Block${index}, ext: "${block.ext}", isReact: ${isReact}, modeName: "${modeName}" },`);
  });
  lines.push("};");

  lines.push("");

  // Initialize hydration
  lines.push("initHydration(blocks);");
  lines.push("");

  return lines.join("\n");
}

/**
 * HydrateRegistry tracks blocks during pre-parse and generates hydrate entry files.
 *
 * Usage:
 * 1. During pre-parse, call `addModule()` for each block with `:use dom`
 * 2. After pre-parse completes, call `generateEntries()` to create entry files
 * 3. Use `getEntryForPage()` to get the entry path for HTML injection
 */
export class HydrateRegistry {
  /** Map of orgPath to blocks on that page */
  private blocks = new Map<string, BlockEntry[]>();

  /**
   * Register a block module for hydration
   *
   * Called by the :use pipeline when transforming a block.
   *
   * @param orgPath - Path to the org file containing the block
   * @param blockId - Unique identifier for the block
   * @param ext - File extension (tsx, ts, js)
   * @param cachePath - Absolute path to the cached file
   * @param virtualModuleId - Virtual module ID for Vite resolution
   * @param modeName - Mode name for rendering (e.g., "dom", "react")
   */
  addModule(
    orgPath: string,
    blockId: string,
    ext: string,
    cachePath: string,
    virtualModuleId: string,
    modeName?: string
  ): void {
    const entry: BlockEntry = { blockId, ext, cachePath, virtualModuleId, modeName };
    const existing = this.blocks.get(orgPath);

    if (existing) {
      existing.push(entry);
    } else {
      this.blocks.set(orgPath, [entry]);
    }
  }

  /**
   * Generate hydrate entry files for all pages with blocks
   *
   * Creates one entry file per page in the cache directory.
   * Returns paths to generated files for use as client build inputs.
   *
   * @param cacheDir - Directory to write entry files to
   * @returns Paths to generated entry files
   */
  generateEntries(cacheDir: string): string[] {
    const generatedPaths: string[] = [];
    const absoluteCacheDir = path.resolve(cacheDir);

    for (const [orgPath, blocks] of this.blocks) {
      const sanitized = sanitizePath(orgPath);
      const entryFileName = `hydrate-${sanitized}.ts`;
      const entryPath = path.join(cacheDir, entryFileName);

      const content = generateHydrateEntry(orgPath, blocks, absoluteCacheDir);
      fs.writeFileSync(entryPath, content);

      generatedPaths.push(entryPath);
    }

    return generatedPaths;
  }

  /**
   * Get the hydrate entry path for a specific page
   *
   * Returns the path to the hydrate entry file for a given org path,
   * or undefined if the page has no blocks.
   *
   * @param orgPath - Path to the org file
   * @returns Path to the hydrate entry file, or undefined
   */
  getEntryForPage(orgPath: string): string | undefined {
    if (!this.blocks.has(orgPath)) {
      return undefined;
    }

    const sanitized = sanitizePath(orgPath);
    return `hydrate-${sanitized}.ts`;
  }

  /**
   * Clear all registered blocks
   *
   * Used for testing or when starting a fresh build.
   */
  clear(): void {
    this.blocks.clear();
  }

  /**
   * Get all registered pages
   *
   * Returns the org paths for all pages that have registered blocks.
   * Useful for debugging.
   *
   * @returns Array of org file paths
   */
  getPages(): string[] {
    return Array.from(this.blocks.keys());
  }

  /**
   * Get blocks for a specific page
   *
   * @param orgPath - Path to the org file
   * @returns Array of block entries, or undefined if page not found
   */
  getBlocks(orgPath: string): BlockEntry[] | undefined {
    return this.blocks.get(orgPath);
  }
}

/**
 * Singleton instance of the HydrateRegistry
 *
 * Use this for the global registry during builds.
 */
export const hydrateRegistry = new HydrateRegistry();
