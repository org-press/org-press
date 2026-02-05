import { visit } from "unist-util-visit";
import type { Element } from "hast";

/**
 * Rehype plugin for automatically generating heading IDs
 *
 * Adds unique IDs to all heading elements (h1-h6) based on their text content.
 * Enables anchor links to specific sections of a page.
 *
 * Features:
 * - Generates URL-safe slugs from heading text
 * - Handles duplicate headings by adding suffixes (-1, -2, etc.)
 * - Preserves existing IDs
 * - Normalizes Unicode characters
 */

/**
 * Convert text to URL-safe slug
 *
 * Process:
 * 1. Lowercase
 * 2. Normalize Unicode (é → e, ñ → n)
 * 3. Remove special characters
 * 4. Replace spaces with hyphens
 * 5. Clean up multiple/leading/trailing hyphens
 *
 * @param text - Text to slugify
 * @returns URL-safe slug
 *
 * @example
 * slugify("Hello World!")
 * // Returns: "hello-world"
 *
 * slugify("Café Olé")
 * // Returns: "cafe-ole"
 *
 * slugify("Multiple   Spaces")
 * // Returns: "multiple-spaces"
 */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      // Normalize Unicode characters (e.g., é -> e, ñ -> n)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Remove special characters, keep alphanumeric and spaces
      .replace(/[^a-z0-9\s-]/g, "")
      // Replace multiple spaces/hyphens with single hyphen
      .replace(/[\s-]+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * Extract text content from an element and its children
 *
 * Recursively walks the element tree and concatenates all text nodes.
 *
 * @param node - Element node
 * @returns Concatenated text content
 *
 * @example
 * // <h2>Hello <strong>World</strong>!</h2>
 * extractText(node)
 * // Returns: "Hello World!"
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
 * Rehype plugin that adds IDs to heading elements (h1-h6)
 *
 * Usage with unified pipeline:
 * ```typescript
 * import { unified } from 'unified';
 * import uniorg2rehype from 'uniorg-rehype';
 * import { rehypeHeadingIds } from './rehype-heading-ids';
 *
 * const processor = unified()
 *   .use(uniorg2rehype)
 *   .use(rehypeHeadingIds())
 *   .use(html);
 * ```
 *
 * @returns Unified plugin transformer
 */
export function rehypeHeadingIds() {
  return (tree: any) => {
    const usedIds = new Set<string>();

    visit(tree, "element", (node: Element) => {
      // Only process heading elements (h1-h6)
      if (!/^h[1-6]$/.test(node.tagName)) {
        return;
      }

      // Skip if heading already has an ID
      if (node.properties?.id) {
        usedIds.add(String(node.properties.id));
        return;
      }

      // Extract text content from heading
      const text = extractText(node);
      let slug = slugify(text);

      // Fallback for empty or invalid slugs
      if (!slug) {
        slug = "heading";
      }

      // Handle duplicates by adding suffix
      let uniqueSlug = slug;
      let counter = 0;
      while (usedIds.has(uniqueSlug)) {
        counter++;
        uniqueSlug = `${slug}-${counter}`;
      }

      // Add the ID to the heading
      if (!node.properties) {
        node.properties = {};
      }
      node.properties.id = uniqueSlug;
      usedIds.add(uniqueSlug);
    });
  };
}
