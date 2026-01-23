import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import type { ParseContext, ParsedOrg } from "./types.ts";
import { extractMetadata } from "./metadata.ts";
import { processCodeBlocks } from "./exporter.ts";
import type { ContentHelpers } from "./execute.ts";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

/**
 * Main parser orchestrator
 *
 * This is the top-level parser function that:
 * 1. Parses org-mode source to AST (uniorg)
 * 2. Extracts metadata
 * 3. Processes code blocks with plugins
 * 4. Returns complete ParsedOrg result
 *
 * Pure function - all dependencies injected via context.
 * No file I/O, no config loading, just transformation.
 */

/**
 * Parse org-mode content to AST and process with plugins
 *
 * Main entry point for parsing org-mode files.
 * Called by the build layer with all dependencies injected.
 *
 * @param source - Raw org-mode file content
 * @param context - Parse context with injected dependencies
 * @param contentHelpers - Optional content helpers for server execution
 * @returns Parsed org with AST, metadata, and generated artifacts
 *
 * @example
 * // In build layer:
 * const config = await loadConfig(".org-press/config.ts");
 * const { plugins } = await loadPlugins(config);
 *
 * const context: ParseContext = {
 *   orgFilePath: "content/post.org",
 *   plugins,
 *   config,
 *   cacheDir: config.cacheDir,
 *   base: config.base,
 *   contentDir: config.contentDir,
 *   outDir: config.outDir,
 * };
 *
 * const parsed = await parseOrgContent(orgSource, context, contentHelpers);
 *
 * // Now render:
 * const html = await renderOrg(parsed.ast, renderContext);
 */
export async function parseOrgContent(
  source: string,
  context: ParseContext,
  contentHelpers?: ContentHelpers
): Promise<ParsedOrg> {
  // 1. Parse org-mode source to AST
  const ast = parse(source) as OrgData;

  // 2. Extract metadata from keywords
  const metadata = extractMetadata(ast);

  // 3. Process code blocks with plugins
  const { virtualModules, cacheFiles, collectedBlocks, modifiedAst } = await processCodeBlocks(
    ast,
    context,
    contentHelpers
  );

  // 4. Return complete parsed result
  return {
    ast: modifiedAst,
    metadata,
    virtualModules,
    cacheFiles,
    collectedBlocks,
  };
}

/**
 * Parse org-mode file from string (simple version)
 *
 * Simplified parser that just returns AST and metadata.
 * Useful for cases where you don't need plugin processing.
 *
 * @param source - Raw org-mode content
 * @returns AST and metadata
 *
 * @example
 * const { ast, metadata } = parseOrgFile(orgSource);
 * console.log(metadata.title); // "My Post"
 */
export function parseOrgFile(source: string): {
  ast: OrgData;
  metadata: ReturnType<typeof extractMetadata>;
} {
  const ast = parse(source) as OrgData;
  const metadata = extractMetadata(ast);

  return {
    ast,
    metadata,
  };
}

/**
 * Extract just metadata without full parsing
 *
 * Lightweight function when you only need metadata.
 * Useful for listing pages, generating indexes, etc.
 *
 * @param source - Raw org-mode content
 * @returns Page metadata
 *
 * @example
 * const metadata = extractOrgMetadata(orgSource);
 * if (metadata.status === "draft") {
 *   // Skip this page in production
 * }
 */
export function extractOrgMetadata(
  source: string
): ReturnType<typeof extractMetadata> {
  const ast = parse(source) as OrgData;
  return extractMetadata(ast);
}

/**
 * Case-insensitive file finder
 *
 * Finds a file in the filesystem ignoring case.
 * Useful for cross-platform compatibility (macOS is case-insensitive, Linux is not).
 *
 * @param targetPath - The path to find (may have incorrect case)
 * @returns The actual file path with correct case, or null if not found
 */
function findFileInsensitive(targetPath: string): string | null {
  if (existsSync(targetPath)) {
    return targetPath;
  }

  // Try case-insensitive lookup
  const dir = join(targetPath, "..");
  const fileName = targetPath.split("/").pop() || "";

  try {
    const files = readdirSync(dir);
    const match = files.find(
      (f) => f.toLowerCase() === fileName.toLowerCase()
    );

    if (match) {
      return join(dir, match);
    }
  } catch {
    // Directory doesn't exist
  }

  return null;
}

/**
 * Convert URL to org file path
 *
 * Maps URLs to corresponding .org files in the content directory.
 * Handles various URL formats and conventions.
 *
 * @param url - URL path (e.g., "/", "/about", "/blog/post")
 * @param contentDir - Content directory (default: "content")
 * @returns Absolute path to org file, or null if not found
 *
 * @example
 * getOrgFileFromUrl("/") // → /path/to/content/index.org
 * getOrgFileFromUrl("/about") // → /path/to/content/about.org
 * getOrgFileFromUrl("/blog/post") // → /path/to/content/blog/post.org
 * getOrgFileFromUrl("/examples") // → /path/to/content/examples/index.org (if examples.org doesn't exist)
 */
export function getOrgFileFromUrl(
  url: string,
  contentDir: string = "content"
): string | null {
  // Strip query parameters first
  let cleanUrl = url.split("?")[0];

  // Strip .html extension if present
  if (cleanUrl.endsWith(".html")) {
    cleanUrl = cleanUrl.slice(0, -5); // Remove '.html'
  }

  // Handle index.html -> index
  if (cleanUrl === "/index") {
    cleanUrl = "/";
  }

  // Special case: /todo or /TODO maps to root TODO.org (for project management)
  if (cleanUrl.toLowerCase() === "/todo") {
    const todoFile = join(process.cwd(), "TODO.org");
    if (existsSync(todoFile)) {
      return todoFile;
    }
  }

  const resolvedContentDir = join(process.cwd(), contentDir);

  // Convert URL to file path
  // "/" -> "index.org"
  // "/about" -> "about.org"
  // "/blog/post" -> "blog/post.org"
  let filePath: string;
  if (cleanUrl === "" || cleanUrl === "/") {
    filePath = "index";
  } else {
    // Remove leading slash
    filePath = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
  }

  // Try two locations:
  // 1. Direct file: "/examples" -> "examples.org"
  // 2. Index file: "/examples" -> "examples/index.org"
  const directFile = join(resolvedContentDir, `${filePath}.org`);
  const indexFile = join(resolvedContentDir, filePath, "index.org");

  // Use case-insensitive file lookup
  let actualFile = findFileInsensitive(directFile);

  // If direct file not found, try index file in directory
  if (!actualFile) {
    actualFile = findFileInsensitive(indexFile);
  }

  if (!actualFile) {
    return null;
  }

  return actualFile;
}
