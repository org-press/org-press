import * as nodeFs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Cache system for org-press
 *
 * Manages caching of extracted code blocks for execution.
 * Provides deterministic paths based on org file structure and block names.
 */

/**
 * Default cache directory
 */
export const CACHE_DIR = "node_modules/.org-press-cache";

/**
 * File system interface for dependency injection
 * Allows testing with in-memory file systems
 */
export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  writeFileSync(path: string, data: string | NodeJS.ArrayBufferView, options?: nodeFs.WriteFileOptions): void;
  readFileSync(path: string, encoding: BufferEncoding): string;
}

// Default to node:fs, can be overridden for testing
let fs: FileSystem = nodeFs;

/**
 * Set the file system implementation
 *
 * Useful for testing with memfs or other in-memory file systems
 *
 * @param newFs - File system implementation
 *
 * @example
 * import { vol } from 'memfs';
 * setFileSystem(vol as any);
 */
export function setFileSystem(newFs: FileSystem): void {
  fs = newFs;
}

/**
 * Reset to the default node:fs implementation
 */
export function resetFileSystem(): void {
  fs = nodeFs;
}

/**
 * Get the current file system implementation
 *
 * @returns Current file system being used
 */
export function getFileSystem(): FileSystem {
  return fs;
}

/**
 * Map language identifiers to file extensions
 */
const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  jsx: "jsx",
  tsx: "tsx",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  python: "py",
  py: "py",
  rust: "rs",
  go: "go",
  shell: "sh",
  bash: "sh",
  sh: "sh",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yml",
  toml: "toml",
  sql: "sql",
  graphql: "gql",
  markdown: "md",
  md: "md",
};

/**
 * Get file extension for a language
 *
 * @param language - Language identifier (e.g., "javascript", "python")
 * @returns File extension (e.g., "js", "py")
 *
 * @example
 * getLanguageExtension("javascript") // Returns: "js"
 * getLanguageExtension("typescript") // Returns: "ts"
 * getLanguageExtension("unknown") // Returns: "unknown"
 */
export function getLanguageExtension(language: string): string {
  const lower = language.toLowerCase();
  return LANGUAGE_EXTENSION_MAP[lower] || lower;
}

/**
 * Sanitize a file path for use as a cache directory path
 *
 * Preserves directory structure but sanitizes individual path segments.
 * Removes the .org extension and normalizes the path.
 *
 * @param filePath - File path to sanitize
 * @returns Sanitized path suitable for cache directory
 *
 * @example
 * sanitizePath("/project/content/blog/post.org")
 * // Returns: "content/blog/post"
 *
 * sanitizePath("content/My Post.org")
 * // Returns: "content/my-post"
 */
export function sanitizePath(filePath: string): string {
  let sanitized = filePath;

  // Convert absolute paths to relative to project root
  const cwd = process.cwd();
  if (path.isAbsolute(filePath)) {
    sanitized = path.relative(cwd, filePath);
  }

  return (
    sanitized
      // Remove .org extension
      .replace(/\.org$/i, "")
      // Normalize backslashes to forward slashes
      .replace(/\\/g, "/")
      // Remove leading slashes or dots
      .replace(/^[\.\/]+/, "")
      // Replace spaces with dashes
      .replace(/\s+/g, "-")
      // Remove special characters except dashes and slashes
      .replace(/[^a-zA-Z0-9\-\/]/g, "")
      // Replace multiple consecutive slashes with single slash
      .replace(/\/+/g, "/")
      // Replace multiple consecutive dashes with single dash
      .replace(/-+/g, "-")
      // Remove trailing slashes
      .replace(/\/$/, "")
      // Lowercase
      .toLowerCase()
  );
}

/**
 * Generate a deterministic short hash for code content
 *
 * Uses SHA256 and takes first 8 characters for a short, deterministic hash.
 * Used for unnamed blocks to create stable cache paths.
 *
 * @param code - Code content to hash
 * @returns 8-character hash
 *
 * @example
 * getBlockHash("console.log('hello');")
 * // Returns: "a1b2c3d4" (deterministic)
 */
export function getBlockHash(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex").slice(0, 8);
}

/**
 * Get the cache file path for a source block
 *
 * Creates a deterministic path based on:
 * - Org file path (preserving directory structure)
 * - Block name (if provided) or content hash (if unnamed)
 * - Language (determines file extension)
 *
 * @param orgFilePath - Path to the .org file
 * @param blockName - Optional block name from #+NAME: directive
 * @param language - Language of the source block
 * @param code - Code content (used for hash if no blockName)
 * @param cacheDir - Optional cache directory (defaults to CACHE_DIR)
 * @returns Full path to the cache file
 *
 * @example
 * // Named block
 * getCachePath("content/post.org", "my-function", "javascript")
 * // Returns: "/project/node_modules/.org-press-cache/content/post/my-function.js"
 *
 * // Unnamed block
 * getCachePath("content/post.org", undefined, "javascript", "console.log('hi');")
 * // Returns: "/project/node_modules/.org-press-cache/content/post/a1b2c3d4.js"
 */
export function getCachePath(
  orgFilePath: string,
  blockName: string | undefined,
  language: string,
  code?: string,
  cacheDir?: string
): string {
  const sanitizedOrgPath = sanitizePath(orgFilePath);
  const extension = getLanguageExtension(language);

  // Use block name if provided, otherwise generate hash from code
  const fileName = blockName || (code ? getBlockHash(code) : "unnamed");

  const baseCacheDir = cacheDir || CACHE_DIR;

  return path.join(
    process.cwd(),
    baseCacheDir,
    sanitizedOrgPath,
    `${fileName}.${extension}`
  );
}

/**
 * Ensure the cache directory exists
 *
 * Creates the directory if it doesn't exist, including parent directories.
 *
 * @param cacheDir - Optional cache directory (defaults to CACHE_DIR)
 * @returns Full path to the cache directory
 *
 * @example
 * const cacheDir = ensureCacheDir();
 * // Creates node_modules/.org-press-cache if it doesn't exist
 */
export function ensureCacheDir(cacheDir?: string): string {
  const dir = cacheDir || path.join(process.cwd(), CACHE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Write code to a cache file
 *
 * Creates the directory if it doesn't exist and writes the code to the file.
 *
 * @param cachePath - Full path to the cache file
 * @param code - Code content to write
 *
 * @example
 * const cachePath = getCachePath("content/post.org", "my-func", "js", "...");
 * await writeToCache(cachePath, "console.log('hello');");
 */
export async function writeToCache(
  cachePath: string,
  code: string
): Promise<void> {
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cachePath, code, "utf-8");
}

/**
 * Read code from a cache file
 *
 * @param cachePath - Full path to the cache file
 * @returns Code content
 *
 * @example
 * const code = await readFromCache(cachePath);
 */
export async function readFromCache(cachePath: string): Promise<string> {
  return fs.readFileSync(cachePath, "utf-8");
}

/**
 * Check if a cache file exists
 *
 * @param cachePath - Full path to the cache file
 * @returns True if the file exists
 */
export function cacheFileExists(cachePath: string): boolean {
  return fs.existsSync(cachePath);
}

/**
 * Clear the entire cache directory
 *
 * Useful for:
 * - Clean builds
 * - Testing
 * - Debugging cache issues
 *
 * @param cacheDir - Optional cache directory (defaults to CACHE_DIR)
 *
 * @example
 * await clearCache();
 * // Removes node_modules/.org-press-cache and all its contents
 */
export async function clearCache(cacheDir?: string): Promise<void> {
  const dir = cacheDir || path.join(process.cwd(), CACHE_DIR);

  if (fs.existsSync(dir)) {
    // Use node:fs/promises for async operation
    const fsPromises = await import("node:fs/promises");
    await fsPromises.rm(dir, { recursive: true, force: true });
  }
}

// ===== Server Result Caching =====

/**
 * Server results cache subdirectory
 */
const SERVER_CACHE_SUBDIR = "server-results";

/**
 * Generate cache key for server execution result
 *
 * @param orgFilePath - Relative path to .org file
 * @param blockIndex - Block index
 * @returns Cache key string
 */
function getServerResultCacheKey(
  orgFilePath: string,
  blockIndex: number
): string {
  const sanitized = orgFilePath.replace(/[/\\]/g, "-").replace(/\.org$/, "");
  return `server-${sanitized}-${blockIndex}.json`;
}

/**
 * Get full path for server result cache file
 *
 * @param orgFilePath - Relative path to .org file
 * @param blockIndex - Block index
 * @param cacheDir - Optional cache directory
 * @returns Full cache file path
 */
function getServerResultCachePath(
  orgFilePath: string,
  blockIndex: number,
  cacheDir?: string
): string {
  const cacheKey = getServerResultCacheKey(orgFilePath, blockIndex);
  const baseCacheDir = cacheDir || path.join(process.cwd(), CACHE_DIR);
  return path.join(baseCacheDir, SERVER_CACHE_SUBDIR, cacheKey);
}

/**
 * Cache server execution result
 *
 * Stores result with timestamp in JSON format.
 *
 * @param orgFilePath - Relative path to .org file
 * @param blockIndex - Block index
 * @param result - Result to cache (any serializable value)
 * @param cacheDir - Optional cache directory
 *
 * @example
 * ```typescript
 * await cacheServerResult('content/index.org', 0, { count: 42 });
 * ```
 */
export async function cacheServerResult(
  orgFilePath: string,
  blockIndex: number,
  result: any,
  cacheDir?: string
): Promise<void> {
  const cachePath = getServerResultCachePath(orgFilePath, blockIndex, cacheDir);
  const dir = path.dirname(cachePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const cacheData = {
    result,
    timestamp: Date.now(),
    orgFilePath,
    blockIndex,
  };

  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");
}

/**
 * Read cached server execution result
 *
 * @param orgFilePath - Relative path to .org file
 * @param blockIndex - Block index
 * @param cacheDir - Optional cache directory
 * @returns Cached result or null if not found
 *
 * @example
 * ```typescript
 * const cached = await readCachedServerResult('content/index.org', 0);
 * if (cached !== null) {
 *   console.log('Using cached result:', cached);
 * }
 * ```
 */
export async function readCachedServerResult(
  orgFilePath: string,
  blockIndex: number,
  cacheDir?: string
): Promise<any | null> {
  const cachePath = getServerResultCachePath(orgFilePath, blockIndex, cacheDir);

  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const content = fs.readFileSync(cachePath, "utf-8");
    const cached = JSON.parse(content);
    return cached.result;
  } catch {
    return null;
  }
}

/**
 * Invalidate server result cache for a file
 *
 * Removes all cached server results for blocks in the specified file.
 *
 * @param orgFilePath - Relative path to .org file
 * @param cacheDir - Optional cache directory
 *
 * @example
 * ```typescript
 * // Called when .org file changes
 * await invalidateServerResultCache('content/index.org');
 * ```
 */
export async function invalidateServerResultCache(
  orgFilePath: string,
  cacheDir?: string
): Promise<void> {
  const baseCacheDir = cacheDir || path.join(process.cwd(), CACHE_DIR);
  const serverCacheDir = path.join(baseCacheDir, SERVER_CACHE_SUBDIR);

  // Pattern to match: server-{sanitized-path}-{index}.json
  const sanitized = orgFilePath.replace(/[/\\]/g, "-").replace(/\.org$/, "");
  const pattern = `server-${sanitized}-`;

  try {
    if (!fs.existsSync(serverCacheDir)) {
      return;
    }

    // Use node:fs/promises for async operations
    // Note: We need to use the real fs for readdir/unlink since memfs
    // may not have these methods in its sync interface
    const fsPromises = await import("node:fs/promises");

    // Check if we're using the injected fs (memfs) or real fs
    // If injected, use sync methods; if real, use async
    if (fs !== nodeFs) {
      // Using injected fs (e.g., memfs in tests)
      // memfs has readdirSync and unlinkSync
      const files = (fs as any).readdirSync(serverCacheDir) as string[];
      for (const f of files) {
        if (f.startsWith(pattern)) {
          try {
            (fs as any).unlinkSync(path.join(serverCacheDir, f));
          } catch {
            // Ignore individual file deletion errors
          }
        }
      }
    } else {
      // Using real fs
      const files = await fsPromises.readdir(serverCacheDir);
      await Promise.all(
        files
          .filter((f) => f.startsWith(pattern))
          .map((f) =>
            fsPromises.unlink(path.join(serverCacheDir, f)).catch(() => {})
          )
      );
    }
  } catch {
    // Ignore errors
  }
}
