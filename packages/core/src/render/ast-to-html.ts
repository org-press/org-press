/**
 * AST to HTML utilities
 *
 * Utility functions for rendering org-mode AST nodes to HTML.
 * These are provided for plugin authors who need to render
 * drawer/element children to HTML.
 *
 * @example
 * ```typescript
 * import { renderChildrenToHtml, extractTextContent } from "org-press";
 *
 * const myDrawer = CreateOrgElement("drawer", {
 *   match: (node) => node.name === "NOTE",
 *   transform: (node) => {
 *     const html = renderChildrenToHtml(node.children);
 *     return `<aside class="note">${html}</aside>`;
 *   },
 * });
 * ```
 */

/**
 * Render AST children to HTML
 *
 * Converts an array of AST nodes to an HTML string.
 * Supports paragraphs, plain lists, and text nodes.
 *
 * @param children - Array of AST nodes
 * @param options - Render options
 * @returns HTML string
 */
export function renderChildrenToHtml(
  children: unknown[],
  options: {
    /** Exclude node-property elements (drawer properties) */
    excludeProperties?: boolean;
  } = {}
): string {
  const { excludeProperties = false } = options;
  const parts: string[] = [];

  for (const child of children as any[]) {
    // Skip properties if requested
    if (excludeProperties && child.type === "node-property") {
      continue;
    }

    if (child.type === "paragraph") {
      const text = extractTextContent(child);
      parts.push(`<p>${text}</p>`);
    } else if (child.type === "plain-list") {
      parts.push(renderListNode(child));
    } else if (child.type === "text") {
      parts.push(child.value || "");
    }
    // Add more node types as needed
  }

  return parts.join("\n");
}

/**
 * Extract text content from a node recursively
 *
 * Walks the AST node and extracts all text values.
 *
 * @param node - AST node
 * @returns Plain text content
 */
export function extractTextContent(node: unknown): string {
  const n = node as any;

  if (n.type === "text") {
    return n.value || "";
  }

  if (n.children && Array.isArray(n.children)) {
    return n.children.map(extractTextContent).join("");
  }

  return "";
}

/**
 * Render a plain-list node to HTML
 *
 * @param node - plain-list AST node
 * @returns HTML string (ul or ol with li items)
 */
export function renderListNode(node: unknown): string {
  const n = node as any;
  const items =
    n.children
      ?.filter((c: any) => c.type === "list-item")
      ?.map((item: any) => `<li>${extractTextContent(item)}</li>`)
      ?.join("\n") || "";

  const tag = n.listType === "ordered" ? "ol" : "ul";
  return `<${tag}>${items}</${tag}>`;
}

/**
 * Extract properties from drawer children
 *
 * Parses children nodes looking for node-property elements.
 * Properties are defined with :KEY: value syntax inside drawers.
 *
 * @param children - AST children nodes
 * @returns Record of property names (uppercase) to values
 */
export function extractDrawerProperties(
  children: unknown[]
): Record<string, string> {
  const props: Record<string, string> = {};

  for (const child of children as any[]) {
    if (child.type === "node-property") {
      const key = (child.key || "").toUpperCase();
      const value = child.value || "";
      if (key) {
        props[key] = value;
      }
    }
  }

  return props;
}
