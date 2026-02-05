import type { OrgData } from "uniorg";
import type { PageMetadata } from "../config/types.ts";

/**
 * Metadata extraction from org-mode AST
 *
 * Pure functions that extract metadata from org keywords.
 * No file I/O - operates only on AST.
 */

/**
 * Extract the title from an org-mode AST
 *
 * Looks for #+TITLE: keyword
 *
 * @param ast - Org-mode AST from uniorg parser
 * @returns Title or undefined if not specified
 *
 * @example
 * #+TITLE: My Blog Post
 * // Returns: "My Blog Post"
 */
export function extractTitle(ast: OrgData): string | undefined {
  if (!ast?.children) return undefined;

  for (const node of ast.children) {
    if (node.type === "keyword" && node.key?.toLowerCase() === "title") {
      const value = node.value?.trim();
      return value || undefined;
    }
  }

  return undefined;
}

/**
 * Extract the author from an org-mode AST
 *
 * Looks for #+AUTHOR: keyword
 *
 * @param ast - Org-mode AST
 * @returns Author or undefined
 *
 * @example
 * #+AUTHOR: John Doe
 * // Returns: "John Doe"
 */
export function extractAuthor(ast: OrgData): string | undefined {
  if (!ast?.children) return undefined;

  for (const node of ast.children) {
    if (node.type === "keyword" && node.key?.toLowerCase() === "author") {
      const value = node.value?.trim();
      return value || undefined;
    }
  }

  return undefined;
}

/**
 * Extract the date from an org-mode AST
 *
 * Looks for #+DATE: keyword
 *
 * @param ast - Org-mode AST
 * @returns Date string or undefined
 *
 * @example
 * #+DATE: 2025-01-15
 * // Returns: "2025-01-15"
 */
export function extractDate(ast: OrgData): string | undefined {
  if (!ast?.children) return undefined;

  for (const node of ast.children) {
    if (node.type === "keyword" && node.key?.toLowerCase() === "date") {
      const value = node.value?.trim();
      return value || undefined;
    }
  }

  return undefined;
}

/**
 * Extract the layout from an org-mode AST
 *
 * Supports two formats:
 * 1. #+LAYOUT: <layout-name>
 * 2. #+PROPERTY: layout <layout-name>
 *
 * When both are present, #+LAYOUT: takes precedence
 *
 * @param ast - Org-mode AST
 * @returns Layout name or undefined
 *
 * @example
 * #+LAYOUT: blog
 * // Returns: "blog"
 *
 * #+PROPERTY: layout doc
 * // Returns: "doc"
 */
export function extractLayout(ast: OrgData): string | undefined {
  if (!ast?.children) return undefined;

  let layoutFromProperty: string | undefined;
  let layoutFromKeyword: string | undefined;

  for (const node of ast.children) {
    // Check for #+LAYOUT: keyword
    if (node.type === "keyword" && node.key?.toLowerCase() === "layout") {
      const value = node.value?.trim();
      if (value) {
        layoutFromKeyword = value;
      }
    }

    // Check for #+PROPERTY: layout keyword
    if (node.type === "keyword" && node.key?.toLowerCase() === "property") {
      const value = node.value?.trim();
      if (value) {
        const parts = value.split(/\s+/);
        if (parts[0]?.toLowerCase() === "layout" && parts[1]) {
          layoutFromProperty = parts[1];
        }
      }
    }
  }

  // #+LAYOUT: takes precedence over #+PROPERTY: layout
  return layoutFromKeyword ?? layoutFromProperty;
}

/**
 * Extract the status/state from an org-mode AST
 *
 * Supports both #+STATUS: and #+STATE: keywords
 * Defaults to "published" if not specified
 *
 * @param ast - Org-mode AST
 * @returns Status ("draft" or "published")
 *
 * @example
 * #+STATUS: draft
 * // Returns: "draft"
 *
 * // No status keyword
 * // Returns: "published"
 */
export function extractStatus(ast: OrgData): string {
  if (!ast?.children) return "published";

  for (const node of ast.children) {
    if (node.type === "keyword") {
      const key = node.key?.toLowerCase();
      if (key === "status" || key === "state") {
        const value = node.value?.trim().toLowerCase();
        return value || "published";
      }
    }
  }

  return "published";
}

/**
 * Extract custom metadata from org keywords
 *
 * Extracts all #+KEY: value pairs that aren't standard keywords
 * Useful for custom metadata like tags, categories, etc.
 *
 * @param ast - Org-mode AST
 * @returns Object with custom metadata
 *
 * @example
 * #+TAGS: javascript, tutorial
 * #+CATEGORY: blog
 * // Returns: { tags: "javascript, tutorial", category: "blog" }
 */
export function extractCustomMetadata(
  ast: OrgData
): Record<string, string> {
  const custom: Record<string, string> = {};

  if (!ast?.children) return custom;

  // Standard keywords to skip
  const standardKeys = new Set([
    "title",
    "author",
    "date",
    "layout",
    "status",
    "state",
    "property",
  ]);

  for (const node of ast.children) {
    if (node.type === "keyword") {
      const key = node.key?.toLowerCase();
      if (key && !standardKeys.has(key)) {
        const value = node.value?.trim();
        if (value) {
          custom[key] = value;
        }
      }
    }
  }

  return custom;
}

/**
 * Extract all metadata from an org-mode AST
 *
 * Combines standard and custom metadata into a single object
 *
 * @param ast - Org-mode AST from uniorg parser
 * @returns Complete page metadata
 *
 * @example
 * const ast = parse(orgContent);
 * const metadata = extractMetadata(ast);
 * console.log(metadata.title); // "My Post"
 * console.log(metadata.author); // "John Doe"
 * console.log(metadata.tags); // "javascript, tutorial" (custom)
 */
export function extractMetadata(ast: OrgData): PageMetadata {
  const standard = {
    title: extractTitle(ast),
    author: extractAuthor(ast),
    date: extractDate(ast),
    layout: extractLayout(ast),
    status: extractStatus(ast),
  };

  const custom = extractCustomMetadata(ast);

  return {
    ...standard,
    ...custom,
  };
}
