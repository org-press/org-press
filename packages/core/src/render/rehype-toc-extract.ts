import { visit } from "unist-util-visit";
import type { Element } from "hast";
import type { TocItem } from "./types.ts";

/**
 * Rehype plugin for extracting table of contents from headings
 *
 * Extracts h2 and h3 headings with their IDs and text content.
 * This should be run AFTER rehypeHeadingIds so that IDs are already assigned.
 *
 * Usage:
 * ```typescript
 * const toc: TocItem[] = [];
 * const processor = unified()
 *   .use(uniorg2rehype)
 *   .use(rehypeHeadingIds)
 *   .use(rehypeTocExtract, { toc })
 *   .use(html);
 * ```
 */

interface RehypeTocExtractOptions {
  /** Array to populate with TOC items (mutated in place) */
  toc: TocItem[];

  /** Minimum heading level to include (default: 2) */
  minLevel?: number;

  /** Maximum heading level to include (default: 3) */
  maxLevel?: number;
}

/**
 * Extract text content from an element and its children
 */
function extractText(node: Element): string {
  let text = "";

  const walk = (n: any) => {
    if (n.type === "text") {
      text += n.value;
    } else if (n.children) {
      n.children.forEach(walk);
    }
  };

  walk(node);
  return text;
}

/**
 * Rehype plugin that extracts TOC items from heading elements
 *
 * @param options - Configuration options
 * @returns Unified plugin transformer
 */
export function rehypeTocExtract(options: RehypeTocExtractOptions) {
  const { toc, minLevel = 2, maxLevel = 3 } = options;

  return (tree: any) => {
    visit(tree, "element", (node: Element) => {
      // Check if it's a heading element
      const match = node.tagName.match(/^h([1-6])$/);
      if (!match) {
        return;
      }

      const level = parseInt(match[1], 10);

      // Only include headings within the specified range
      if (level < minLevel || level > maxLevel) {
        return;
      }

      // Get the ID (should be set by rehypeHeadingIds)
      const id = node.properties?.id;
      if (!id || typeof id !== "string") {
        return;
      }

      // Extract text content
      const text = extractText(node).trim();
      if (!text) {
        return;
      }

      toc.push({
        id,
        text,
        level,
      });
    });
  };
}
