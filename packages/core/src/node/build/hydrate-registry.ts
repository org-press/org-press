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

/**
 * Generate a hydrate entry file content for a page
 *
 * Creates JavaScript code that imports all block modules and hydrates them
 * by finding their DOM elements and calling the exported functions.
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
 *   cachePath: "/abs/path/.org-press-cache/content/index/landing-controller.ts"
 * }], "/abs/path/.org-press-cache")
 * // Returns JavaScript that imports the block using #cache alias
 */
export function generateHydrateEntry(orgPath: string, blocks: BlockEntry[], cacheDir?: string): string {
  if (blocks.length === 0) {
    return `// Auto-generated hydrate entry for ${orgPath}\n// No blocks to hydrate\n`;
  }

  const lines: string[] = [];

  // Header comment
  lines.push(`// Auto-generated hydrate entry for ${orgPath}`);

  // Import statements using relative paths from hydrate entry file
  // Since the hydrate entry is in cacheDir root, we need path relative to that
  blocks.forEach((block, index) => {
    // Convert absolute cache path to relative path from cache dir
    // e.g., "/abs/.org-press-cache/content/index/file.ts" -> "./content/index/file.ts"
    let importPath = block.cachePath;
    if (cacheDir) {
      const absoluteCacheDir = path.resolve(cacheDir);
      if (block.cachePath.startsWith(absoluteCacheDir)) {
        const relativePath = block.cachePath.slice(absoluteCacheDir.length + 1);
        importPath = `./${relativePath}`;
      }
    }
    lines.push(`import block_${index} from "${importPath}";`);
  });

  lines.push("");

  // Blocks mapping object
  lines.push("const blocks = {");
  blocks.forEach((block, index) => {
    lines.push(`  "${block.blockId}": block_${index},`);
  });
  lines.push("};");

  lines.push("");

  // Hydrate function - handles different export types
  lines.push("function hydrate() {");
  lines.push("  for (const [id, mod] of Object.entries(blocks)) {");
  lines.push(`    const el = document.querySelector('[data-org-block="' + id + '"]');`);
  lines.push("    if (!el) continue;");
  lines.push("    // Handle function exports (render function that takes container ID)");
  lines.push("    if (typeof mod === \"function\") {");
  lines.push("      mod(el.id);");
  lines.push("    } else if (mod && typeof mod.default === \"function\") {");
  lines.push("      mod.default(el.id);");
  lines.push("    }");
  lines.push("    // Handle HTMLElement exports (pre-created DOM elements)");
  lines.push("    else if (mod instanceof HTMLElement) {");
  lines.push("      el.appendChild(mod);");
  lines.push("    } else if (mod && mod.default instanceof HTMLElement) {");
  lines.push("      el.appendChild(mod.default);");
  lines.push("    }");
  lines.push("    // Handle string exports (HTML strings)");
  lines.push("    else if (typeof mod === \"string\") {");
  lines.push("      el.innerHTML = mod;");
  lines.push("    } else if (mod && typeof mod.default === \"string\") {");
  lines.push("      el.innerHTML = mod.default;");
  lines.push("    }");
  lines.push("  }");
  lines.push("}");

  lines.push("");

  // DOMContentLoaded handling
  lines.push(`if (document.readyState === "loading") {`);
  lines.push(`  document.addEventListener("DOMContentLoaded", hydrate);`);
  lines.push("} else {");
  lines.push("  hydrate();");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * HydrateRegistry tracks blocks during pre-parse and generates hydrate entry files.
 *
 * Usage:
 * 1. During pre-parse, call `addModule()` for each block with `:use preview`
 * 2. After pre-parse completes, call `generateEntries()` to create entry files
 * 3. Use `getEntryForPage()` to get the entry path for HTML injection
 */
export class HydrateRegistry {
  /** Map of orgPath to blocks on that page */
  private blocks = new Map<string, BlockEntry[]>();

  /**
   * Register a block module for hydration
   *
   * Called by the :use preview pipeline when transforming a block.
   *
   * @param orgPath - Path to the org file containing the block
   * @param blockId - Unique identifier for the block
   * @param ext - File extension (tsx, ts, js)
   * @param cachePath - Absolute path to the cached file
   */
  addModule(
    orgPath: string,
    blockId: string,
    ext: string,
    cachePath: string
  ): void {
    const entry: BlockEntry = { blockId, ext, cachePath };
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
