/**
 * Content API for Org-Press 2
 *
 * Provides functions for querying and rendering .org files.
 * Used primarily in server-side execution blocks (`:use server`)
 * where the `content` global provides access to these functions.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import { extractMetadata } from "./parser/metadata.ts";
import type { PageMetadata } from "./parser/types.ts";

/**
 * Content page with metadata and URL
 */
export interface ContentPage {
  /** Relative path from content directory (e.g., "blog/my-post.org") */
  file: string;

  /** URL path (e.g., "/blog/my-post") */
  url: string;

  /** Extracted metadata from org file */
  metadata: PageMetadata;
}

/**
 * Options for querying content pages
 */
export interface ContentQueryOptions {
  /** Include draft pages (default: false in production, true in development) */
  includeDrafts?: boolean;

  /** Filter to a specific directory within content (e.g., "blog") */
  directory?: string;

  /** Content directory (default: "content") */
  contentDir?: string;

  /** Sort by field (default: "file") */
  sortBy?: "file" | "date" | "title";

  /** Sort order (default: "desc") */
  sortOrder?: "asc" | "desc";
}

/**
 * Cache for content pages
 * Key: contentDir:directory:includeDrafts
 */
const contentCache = new Map<string, ContentPage[]>();

/**
 * Check if we're in development mode
 *
 * @returns true if NODE_ENV is not "production"
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Recursively get all .org files from a directory
 *
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
async function getOrgFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await getOrgFilesRecursive(fullPath)));
      } else if (entry.name.endsWith(".org")) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - return empty array
    console.warn(`[content] Cannot read directory: ${dir}`);
  }

  return files;
}

/**
 * Get all content pages with their metadata
 *
 * Automatically filters out drafts in production unless includeDrafts is true.
 * Results are cached for performance.
 *
 * @param options - Options for filtering and sorting content
 * @returns Array of content pages with metadata
 *
 * @example
 * // Get all published posts
 * const posts = await getContentPages();
 *
 * @example
 * // Get blog posts sorted by date
 * const posts = await getContentPages({
 *   directory: "blog",
 *   sortBy: "date",
 *   sortOrder: "desc"
 * });
 */
export async function getContentPages(
  options: ContentQueryOptions = {}
): Promise<ContentPage[]> {
  const {
    includeDrafts = isDevelopment(),
    directory,
    contentDir: contentDirOption = "content",
    sortBy = "file",
    sortOrder = "desc",
  } = options;

  // Check cache
  const cacheKey = `${contentDirOption}:${directory || ""}:${includeDrafts}`;
  if (contentCache.has(cacheKey)) {
    const cached = contentCache.get(cacheKey)!;
    return sortPages(cached, sortBy, sortOrder);
  }

  const contentDir = join(process.cwd(), contentDirOption);
  const searchDir = directory ? join(contentDir, directory) : contentDir;

  const orgFiles = await getOrgFilesRecursive(searchDir);
  const pages: ContentPage[] = [];

  for (const filePath of orgFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const ast = parse(content);
      const metadata = extractMetadata(ast);

      // Skip drafts unless includeDrafts is true
      if (!includeDrafts && metadata.status === "draft") {
        continue;
      }

      const relPath = relative(contentDir, filePath);
      const url =
        "/" +
        relPath
          .replace(/\.org$/, "")
          .replace(/\/index$/, "")
          .toLowerCase();

      pages.push({
        file: relPath,
        url: url === "/index" ? "/" : url,
        metadata,
      });
    } catch (error) {
      console.warn(`[content] Error parsing ${filePath}:`, error);
    }
  }

  // Cache the result
  contentCache.set(cacheKey, pages);

  return sortPages(pages, sortBy, sortOrder);
}

/**
 * Get content pages from a specific directory
 *
 * Convenience function that calls getContentPages with directory filter.
 *
 * @param directory - Directory within content (e.g., "blog")
 * @param options - Additional query options
 * @returns Array of content pages
 *
 * @example
 * // Get all blog posts
 * const posts = await getContentPagesFromDirectory("blog");
 *
 * @example
 * // Get blog posts including drafts
 * const posts = await getContentPagesFromDirectory("blog", {
 *   includeDrafts: true
 * });
 */
export async function getContentPagesFromDirectory(
  directory: string,
  options: Omit<ContentQueryOptions, "directory"> = {}
): Promise<ContentPage[]> {
  return getContentPages({ ...options, directory });
}

/**
 * Sort pages by specified field and order
 *
 * @param pages - Array of pages to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort order
 * @returns Sorted array (new array, does not modify original)
 */
function sortPages(
  pages: ContentPage[],
  sortBy: "file" | "date" | "title",
  sortOrder: "asc" | "desc"
): ContentPage[] {
  const sorted = [...pages];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "file":
        comparison = a.file.localeCompare(b.file);
        break;

      case "date":
        const dateA = a.metadata.date || "";
        const dateB = b.metadata.date || "";
        comparison = dateA.localeCompare(dateB);
        break;

      case "title":
        const titleA = a.metadata.title || "";
        const titleB = b.metadata.title || "";
        comparison = titleA.localeCompare(titleB);
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Render a list of content pages as HTML
 *
 * @param pages - Array of content pages
 * @param options - Render options
 * @returns HTML string with list
 *
 * @example
 * const posts = await getContentPages({ directory: "blog" });
 * return renderPageList(posts);
 *
 * @example
 * return renderPageList(posts, {
 *   showDate: true,
 *   showAuthor: true
 * });
 */
export function renderPageList(
  pages: ContentPage[],
  options: {
    showDate?: boolean;
    showAuthor?: boolean;
    showExcerpt?: boolean;
  } = {}
): string {
  const { showDate = false, showAuthor = false, showExcerpt = false } = options;

  if (pages.length === 0) {
    return "<p>No posts found.</p>";
  }

  const items = pages.map((page) => {
    const title = page.metadata.title || page.file.replace(".org", "");
    const parts: string[] = [];

    parts.push(`<a href="${page.url}.html">${escapeHtml(title)}</a>`);

    if (showDate && page.metadata.date) {
      parts.push(`<time>${escapeHtml(page.metadata.date)}</time>`);
    }

    if (showAuthor && page.metadata.author) {
      parts.push(`<span class="author">by ${escapeHtml(page.metadata.author)}</span>`);
    }

    if (showExcerpt && page.metadata.description) {
      parts.push(`<p class="excerpt">${escapeHtml(page.metadata.description)}</p>`);
    }

    return `<li>${parts.join(" ")}</li>`;
  });

  return `<ul class="content-list">${items.join("")}</ul>`;
}

/**
 * Clear content cache
 *
 * Useful when .org files change during development.
 */
export function clearContentCache(): void {
  contentCache.clear();
}

/**
 * Escape HTML special characters
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Options for dangerousWriteContentBlock
 */
export interface WriteBlockOptions {
  /** File path relative to content directory */
  file: string;

  /** Block identifier - either :name value or numeric index (0-based) */
  block: string | number;

  /** New content for the block (just the code, not the #+begin_src line) */
  content: string;

  /** Trigger rebuild after writing (default: false) */
  rebuild?: boolean;
}

/**
 * Result of dangerousWriteContentBlock
 */
export interface WriteBlockResult {
  success: boolean;
  file: string;
  block: string | number;
  error?: string;
}

/**
 * Regex to match org-mode source blocks
 * Captures: language, parameters, and content
 */
const SRC_BLOCK_REGEX = /^([ \t]*)#\+begin_src\s+(\w+)(.*?)\n([\s\S]*?)^\1#\+end_src/gim;

/**
 * Extract :name parameter from block header
 */
function extractBlockName(params: string): string | null {
  const match = params.match(/:name\s+(\S+)/);
  return match ? match[1] : null;
}

/**
 * Find and replace a source block in org content
 *
 * @param orgContent - Full org file content
 * @param blockId - Block name or index
 * @param newContent - New content for the block
 * @returns Updated org content or null if block not found
 */
function replaceBlock(
  orgContent: string,
  blockId: string | number,
  newContent: string
): string | null {
  const blocks: Array<{
    start: number;
    end: number;
    indent: string;
    lang: string;
    params: string;
    name: string | null;
  }> = [];

  // Find all source blocks
  let match;
  const regex = new RegExp(SRC_BLOCK_REGEX.source, SRC_BLOCK_REGEX.flags);
  while ((match = regex.exec(orgContent)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      indent: match[1],
      lang: match[2],
      params: match[3],
      name: extractBlockName(match[3]),
    });
  }

  // Find target block
  let targetIndex: number;
  if (typeof blockId === "number") {
    targetIndex = blockId;
  } else {
    targetIndex = blocks.findIndex((b) => b.name === blockId);
  }

  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return null;
  }

  const target = blocks[targetIndex];

  // Reconstruct the block with new content
  const header = `${target.indent}#+begin_src ${target.lang}${target.params}`;
  const footer = `${target.indent}#+end_src`;

  // Indent new content to match block indentation
  const indentedContent = newContent
    .split("\n")
    .map((line) => (line ? target.indent + line : line))
    .join("\n");

  const newBlock = `${header}\n${indentedContent}\n${footer}`;

  // Replace in content
  return (
    orgContent.substring(0, target.start) +
    newBlock +
    orgContent.substring(target.end)
  );
}

// Rebuild callback - set by the build system
let rebuildCallback: ((file: string) => Promise<void>) | null = null;

/**
 * Set the rebuild callback function
 * Called by the build system to enable rebuild triggering
 */
export function setRebuildCallback(
  callback: (file: string) => Promise<void>
): void {
  rebuildCallback = callback;
}

/**
 * Dangerously write to a content block in an org file
 *
 * This function modifies org files directly. Use with caution.
 * The "dangerous" prefix indicates this performs file system writes.
 *
 * @param options - Write options
 * @returns Result of the write operation
 *
 * @example
 * // Write to a named block
 * await dangerousWriteContentBlock({
 *   file: "thoughts.org",
 *   block: "articles-list",
 *   content: `const pages = await content.getContentPages();
 * export default pages;`,
 *   rebuild: true
 * });
 *
 * @example
 * // Write to block by index (first source block)
 * await dangerousWriteContentBlock({
 *   file: "demo.org",
 *   block: 0,
 *   content: "export default 'Hello!';"
 * });
 */
export async function dangerousWriteContentBlock(
  options: WriteBlockOptions
): Promise<WriteBlockResult> {
  const { file, block, content, rebuild = false } = options;

  const filePath = join(process.cwd(), "content", file);

  try {
    // Read current file content
    const orgContent = await readFile(filePath, "utf-8");

    // Replace the block
    const newContent = replaceBlock(orgContent, block, content);

    if (newContent === null) {
      return {
        success: false,
        file,
        block,
        error: `Block not found: ${block}`,
      };
    }

    // Write back to file
    await writeFile(filePath, newContent, "utf-8");

    // Clear cache since file changed
    clearContentCache();

    // Trigger rebuild if requested
    if (rebuild && rebuildCallback) {
      await rebuildCallback(file);
    }

    return {
      success: true,
      file,
      block,
    };
  } catch (error) {
    return {
      success: false,
      file,
      block,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Content helpers object for server execution
 *
 * This object is injected into server-side blocks via the `content` global.
 */
export const contentHelpers = {
  getContentPages,
  getContentPagesFromDirectory,
  renderPageList,
  clearCache: clearContentCache,
  isDevelopment,
  dangerousWriteContentBlock,
};

/**
 * Type for content helpers (used in parser/execute.ts)
 */
export type ContentHelpers = typeof contentHelpers;
