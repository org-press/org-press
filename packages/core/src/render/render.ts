import { unified } from "unified";
import uniorg2rehype from "uniorg-rehype";
import html from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { visit } from "unist-util-visit";
import type { OrgData } from "uniorg";
import type { RenderContext, RenderResult, TocItem } from "./types.ts";
import { rehypeHeadingIds } from "./rehype-heading-ids.ts";
import { rehypeTocExtract } from "./rehype-toc-extract.ts";

/**
 * Render layer
 *
 * Converts org-mode AST to HTML without layout application.
 * Pure functions that receive AST and return HTML.
 */

/**
 * Rehype plugin to transform org-mode file links to HTML links
 *
 * Transforms:
 * - file:sicilia/page.org → /sicilia/page.html
 * - Relative paths: ./other.org → /current-dir/other.html
 * - Handles .org extension conversion
 *
 * @param currentFilePath - Path of current org file (e.g., "plugins/index.org")
 * @param base - Base URL path (e.g., "/" or "/org-press")
 */
function rehypeOrgLinks(currentFilePath?: string, base: string = "/") {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName === "a" && node.properties?.href) {
        let href = node.properties.href;

        // Handle file: protocol links
        if (href.startsWith("file:")) {
          href = href.replace(/^file:/, "");

          // Resolve relative paths (./ or ../)
          if (
            currentFilePath &&
            (href.startsWith("./") || href.startsWith("../"))
          ) {
            // Get directory of current file
            const currentDir = currentFilePath.split("/").slice(0, -1).join("/");

            // Resolve the relative path
            const parts = currentDir ? currentDir.split("/") : [];
            const hrefParts = href.split("/");

            for (const part of hrefParts) {
              if (part === "..") {
                parts.pop();
              } else if (part !== "." && part !== "") {
                parts.push(part);
              }
            }

            href = "/" + parts.join("/");
          } else if (!href.startsWith("/")) {
            // Absolute path from content root
            href = "/" + href;
          }
        }

        // Convert .org extension to .html
        if (href.endsWith(".org")) {
          href = href.replace(/\.org$/, ".html");
        }

        // Apply base path
        if (base !== "/" && href.startsWith("/") && !href.startsWith(base)) {
          href = base + href;
        }

        node.properties.href = href;
      }
    });
  };
}

/**
 * Create unified processor for org-mode → HTML conversion
 *
 * Pipeline:
 * 1. uniorg2rehype - org AST → rehype (HTML AST)
 * 2. rehype-raw - handle raw HTML in org content
 * 3. rehypeOrgLinks - transform org file links
 * 4. rehypeHeadingIds - add IDs to headings
 * 5. rehypeTocExtract - extract TOC from headings (optional)
 * 6. rehype-highlight - syntax highlighting for code blocks
 * 7. rehype-stringify - HTML AST → HTML string
 *
 * @param orgFilePath - Path to org file (for link resolution)
 * @param base - Base URL path
 * @param toc - Optional array to populate with TOC items
 * @returns Unified processor
 */
function createOrgProcessor(
  orgFilePath?: string,
  base: string = "/",
  toc?: TocItem[]
) {
  let processor = unified()
    .use(uniorg2rehype)
    .use(rehypeRaw)
    .use(rehypeOrgLinks, orgFilePath, base)
    .use(rehypeHeadingIds);

  // Add TOC extraction if array provided
  if (toc) {
    processor = processor.use(rehypeTocExtract, { toc });
  }

  return processor.use(rehypeHighlight).use(html);
}

/**
 * Render org-mode AST to HTML
 *
 * Pure rendering function - receives AST, returns HTML.
 * No layout application (that's in render-static.tsx).
 *
 * @param ast - Org-mode AST (already parsed and transformed)
 * @param context - Render context with base path and metadata
 * @returns Rendered HTML result with optional TOC
 *
 * @example
 * // In build layer:
 * const parsed = await parseOrgContent(source, parseContext);
 * const rendered = await renderOrg(parsed.ast, {
 *   base: "/",
 *   metadata: parsed.metadata,
 * });
 * console.log(rendered.html); // HTML string
 * console.log(rendered.toc);  // TOC items (h2/h3)
 */
export async function renderOrg(
  ast: OrgData,
  context: RenderContext
): Promise<RenderResult> {
  // Array to collect TOC items
  const toc: TocItem[] = [];

  // Create processor with context and TOC extraction
  const processor = createOrgProcessor(undefined, context.base, toc);

  // Convert AST to rehype (HTML AST)
  const rehypeTree = await processor.run(ast);

  // Stringify to HTML
  const contentHtml = processor.stringify(rehypeTree);

  return {
    html: String(contentHtml),
    metadata: context.metadata,
    toc: toc.length > 0 ? toc : undefined,
  };
}

/**
 * Render org-mode AST to HTML string (convenience function)
 *
 * Simplified version that just returns the HTML string.
 *
 * @param ast - Org-mode AST
 * @param context - Render context
 * @returns HTML string
 *
 * @example
 * const html = await renderOrgToHtml(ast, context);
 */
export async function renderOrgToHtml(
  ast: OrgData,
  context: RenderContext
): Promise<string> {
  const result = await renderOrg(ast, context);
  return result.html;
}

/**
 * Render with custom rehype plugins
 *
 * Advanced function for adding custom rehype plugins to the pipeline.
 *
 * @param ast - Org-mode AST
 * @param context - Render context
 * @param plugins - Additional rehype plugins to use
 * @returns Rendered HTML
 *
 * @example
 * import remarkGfm from 'remark-gfm';
 *
 * const html = await renderOrgWithPlugins(ast, context, [
 *   [remarkGfm, { singleTilde: false }]
 * ]);
 */
export async function renderOrgWithPlugins(
  ast: OrgData,
  context: RenderContext,
  plugins: Array<any>
): Promise<string> {
  let processor = createOrgProcessor(undefined, context.base);

  // Add custom plugins
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      processor = processor.use(plugin[0], plugin[1]);
    } else {
      processor = processor.use(plugin);
    }
  }

  const rehypeTree = await processor.run(ast);
  return String(processor.stringify(rehypeTree));
}
