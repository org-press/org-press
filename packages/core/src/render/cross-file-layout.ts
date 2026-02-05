/**
 * Cross-File Layout Resolution
 *
 * Enables referencing layout and wrapper blocks from other .org files:
 *
 * ```org
 * #+LAYOUT: ./layouts.org#base-layout
 * #+WRAPPER: ../shared/wrappers.org#article
 * ```
 *
 * Path Resolution Rules:
 * - `./path.org#name` - Relative to current .org file
 * - `../path.org#name` - Relative to current .org file (parent dir)
 * - `/path.org#name` - Absolute from content directory root
 */

import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import type { LayoutBlock, LayoutBlockType } from "./org-layout.ts";

/**
 * Parsed cross-file layout reference
 */
export interface CrossFileLayoutRef {
  /** Relative or absolute path to org file */
  filePath: string;
  /** Block name (without #) */
  blockName: string;
  /** Whether path is absolute (starts with /) */
  isAbsolute: boolean;
}

/**
 * Cache entry for external org files
 */
interface CacheEntry {
  ast: OrgData;
  mtime: number;
}

/**
 * Cache for parsed external org files
 */
const externalOrgCache = new Map<string, CacheEntry>();

/**
 * Stack for detecting circular references during loading
 */
const loadingStack = new Set<string>();

/**
 * Check if a layout reference is a cross-file reference
 *
 * Cross-file references match the pattern: `./path.org#block` or `/path.org#block`
 * They must contain a file path (with .org extension) and a block name after #.
 *
 * @param ref - The layout/wrapper reference string
 * @returns True if this is a cross-file reference
 */
export function isCrossFileLayoutRef(ref: string | undefined): boolean {
  if (!ref || typeof ref !== "string") {
    return false;
  }

  // Must contain # with something before and after
  const hashIndex = ref.indexOf("#");
  if (hashIndex <= 0 || hashIndex === ref.length - 1) {
    return false;
  }

  const filePart = ref.slice(0, hashIndex);
  const blockPart = ref.slice(hashIndex + 1);

  // Must have a block name
  if (!blockPart || blockPart.length === 0) {
    return false;
  }

  // File path must end with .org
  if (!filePart.endsWith(".org")) {
    return false;
  }

  // Must be a path (starts with ./, ../, or /)
  if (!filePart.startsWith("./") && !filePart.startsWith("../") && !filePart.startsWith("/")) {
    return false;
  }

  return true;
}

/**
 * Parse a cross-file layout reference
 *
 * @param ref - The layout/wrapper reference string
 * @returns Parsed reference or null if invalid
 */
export function parseCrossFileLayoutRef(ref: string): CrossFileLayoutRef | null {
  if (!isCrossFileLayoutRef(ref)) {
    return null;
  }

  const hashIndex = ref.indexOf("#");
  const filePath = ref.slice(0, hashIndex);
  const blockName = ref.slice(hashIndex + 1);

  return {
    filePath,
    blockName,
    isAbsolute: filePath.startsWith("/"),
  };
}

/**
 * Resolve cross-file path to absolute filesystem path
 *
 * @param ref - Parsed cross-file reference
 * @param currentOrgFile - Absolute path to the current .org file
 * @param contentDir - Content directory root (for absolute paths)
 * @returns Absolute filesystem path to the referenced org file
 */
export function resolveCrossFilePath(
  ref: CrossFileLayoutRef,
  currentOrgFile: string,
  contentDir: string
): string {
  if (ref.isAbsolute) {
    // Absolute path from content directory root
    // Remove leading slash and join with content dir
    const relativePath = ref.filePath.slice(1);
    return join(contentDir, relativePath);
  }

  // Relative path from current org file
  const currentDir = dirname(currentOrgFile);
  return resolve(currentDir, ref.filePath);
}

/**
 * Determine block type from language
 */
function getBlockType(language: string): LayoutBlockType {
  const lang = language.toLowerCase();
  if (lang === "jsx") return "jsx";
  if (lang === "tsx") return "tsx";
  if (lang === "javascript" || lang === "js") return "js";
  if (lang === "typescript" || lang === "ts") return "ts";
  return "html";
}

/**
 * Find a named block in an org AST
 *
 * @param ast - Parsed org AST
 * @param blockName - Name of the block to find (without #)
 * @returns The block node or undefined
 */
function findNamedBlock(ast: OrgData, blockName: string): any | undefined {
  let foundBlock: any | undefined;

  function walk(node: any): void {
    if (foundBlock || !node) return;

    if (node.type === "src-block") {
      const name = node.affiliated?.NAME;
      if (name === blockName) {
        foundBlock = node;
        return;
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return foundBlock;
}

/**
 * Parse an external org file and cache the result
 *
 * @param absolutePath - Absolute path to the org file
 * @param devMode - If true, check mtime and invalidate stale cache
 * @returns Parsed AST
 */
async function parseExternalOrgFile(
  absolutePath: string,
  devMode: boolean = false
): Promise<OrgData> {
  // Check cache
  const cached = externalOrgCache.get(absolutePath);

  if (cached) {
    if (devMode) {
      // In dev mode, check if file has changed
      try {
        const stats = await stat(absolutePath);
        if (stats.mtimeMs <= cached.mtime) {
          return cached.ast;
        }
        // File changed, invalidate cache entry
        externalOrgCache.delete(absolutePath);
      } catch {
        // File may have been deleted, invalidate cache
        externalOrgCache.delete(absolutePath);
      }
    } else {
      // In build mode, use cached AST without mtime check
      return cached.ast;
    }
  }

  // Parse file
  const content = await readFile(absolutePath, "utf-8");
  const ast = parse(content) as OrgData;

  // Cache result
  try {
    const stats = await stat(absolutePath);
    externalOrgCache.set(absolutePath, {
      ast,
      mtime: stats.mtimeMs,
    });
  } catch {
    // Cache without mtime if stat fails
    externalOrgCache.set(absolutePath, {
      ast,
      mtime: 0,
    });
  }

  return ast;
}

/**
 * Load a layout block from an external org file
 *
 * @param ref - The layout/wrapper reference string (e.g., "./layouts.org#base")
 * @param currentOrgFile - Absolute path to the current .org file
 * @param contentDir - Content directory root
 * @param devMode - If true, check file mtime for cache invalidation
 * @returns The extracted layout block or undefined
 */
export async function loadCrossFileLayout(
  ref: string,
  currentOrgFile: string,
  contentDir: string,
  devMode: boolean = false
): Promise<LayoutBlock | undefined> {
  // Parse reference
  const parsed = parseCrossFileLayoutRef(ref);
  if (!parsed) {
    console.warn(`[cross-file-layout] Invalid reference: ${ref}`);
    return undefined;
  }

  // Resolve to absolute path
  const absolutePath = resolveCrossFilePath(parsed, currentOrgFile, contentDir);

  // Check for circular references
  if (loadingStack.has(absolutePath)) {
    console.error(`[cross-file-layout] Circular reference detected: ${absolutePath}`);
    return undefined;
  }

  // Check if file exists
  if (!existsSync(absolutePath)) {
    console.warn(`[cross-file-layout] File not found: ${absolutePath}`);
    return undefined;
  }

  // Add to loading stack for circular reference detection
  loadingStack.add(absolutePath);

  try {
    // Parse external org file
    const ast = await parseExternalOrgFile(absolutePath, devMode);

    // Find the named block
    const block = findNamedBlock(ast, parsed.blockName);

    if (!block) {
      console.warn(
        `[cross-file-layout] Block not found: #${parsed.blockName} in ${absolutePath}`
      );
      return undefined;
    }

    // Extract layout block
    return {
      name: parsed.blockName,
      type: getBlockType(block.language || "js"),
      code: block.value || "",
      language: block.language || "javascript",
    };
  } catch (error) {
    console.error(`[cross-file-layout] Error loading ${absolutePath}:`, error);
    return undefined;
  } finally {
    // Remove from loading stack
    loadingStack.delete(absolutePath);
  }
}

/**
 * Clear the external org file cache
 *
 * @param filePath - Optional specific file path to clear (absolute path).
 *                   If not provided, clears entire cache.
 */
export function clearCrossFileCache(filePath?: string): void {
  if (filePath) {
    externalOrgCache.delete(filePath);
  } else {
    externalOrgCache.clear();
  }
}

/**
 * Invalidate cache if file has changed (for HMR)
 *
 * @param absolutePath - Absolute path to the file
 * @returns True if cache was invalidated
 */
export async function invalidateCacheIfChanged(absolutePath: string): Promise<boolean> {
  const cached = externalOrgCache.get(absolutePath);
  if (!cached) {
    return false;
  }

  try {
    const stats = await stat(absolutePath);
    if (stats.mtimeMs > cached.mtime) {
      externalOrgCache.delete(absolutePath);
      return true;
    }
  } catch {
    // File may have been deleted
    externalOrgCache.delete(absolutePath);
    return true;
  }

  return false;
}

/**
 * Get all cached file paths (for debugging/testing)
 */
export function getCachedFilePaths(): string[] {
  return Array.from(externalOrgCache.keys());
}
