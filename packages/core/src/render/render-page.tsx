import type { PageRenderOptions } from "./types.ts";

/**
 * Full page rendering
 *
 * Wraps rendered content in complete HTML document structure.
 * Injects scripts, styles, and metadata.
 */

/**
 * Render complete HTML page
 *
 * Takes rendered body HTML and wraps it in a complete HTML document
 * with DOCTYPE, head, and all necessary assets.
 *
 * @param options - Page render options
 * @returns Complete HTML document string
 *
 * @example
 * const page = renderFullPage({
 *   bodyHtml: renderedWithLayout,
 *   metadata: { title: "My Post" },
 *   base: "/",
 *   scripts: ["/assets/main.js"],
 *   styles: ["/assets/main.css"],
 * });
 */
export function renderFullPage(options: PageRenderOptions): string {
  const {
    bodyHtml,
    metadata,
    base,
    scripts = [],
    styles = [],
    head = "",
  } = options;

  // Build head content
  const headContent = buildHead({
    metadata,
    base,
    styles,
    additionalHead: head,
  });

  // Build body with scripts
  const bodyContent = buildBody({
    bodyHtml,
    scripts,
  });

  // Combine into full document
  return `<!DOCTYPE html>
<html lang="en">
${headContent}
${bodyContent}
</html>`;
}

/**
 * Build <head> section
 */
function buildHead(options: {
  metadata: any;
  base: string;
  styles: string[];
  additionalHead?: string;
}): string {
  const { metadata, base, styles, additionalHead } = options;

  const parts: string[] = ["<head>"];

  // Essential meta tags
  parts.push('  <meta charset="utf-8">');
  parts.push('  <meta name="viewport" content="width=device-width, initial-scale=1">');

  // Base URL
  if (base && base !== "/") {
    parts.push(`  <base href="${base}">`);
  }

  // Title
  const title = metadata.title || "Org-Press";
  parts.push(`  <title>${escapeHtml(title)}</title>`);

  // Meta tags from metadata
  if (metadata.author) {
    parts.push(`  <meta name="author" content="${escapeHtml(metadata.author)}">`);
  }

  if (metadata.date) {
    parts.push(`  <meta name="date" content="${escapeHtml(metadata.date)}">`);
  }

  if (metadata.description) {
    parts.push(
      `  <meta name="description" content="${escapeHtml(metadata.description)}">`
    );
  }

  // Styles
  for (const style of styles) {
    parts.push(`  <link rel="stylesheet" href="${style}">`);
  }

  // Additional head content
  if (additionalHead) {
    parts.push(`  ${additionalHead}`);
  }

  parts.push("</head>");

  return parts.join("\n");
}

/**
 * Build <body> section with scripts
 */
function buildBody(options: {
  bodyHtml: string;
  scripts: string[];
}): string {
  const { bodyHtml, scripts } = options;

  const parts: string[] = ["<body>"];

  // Body content
  parts.push(bodyHtml);

  // Scripts at end of body for performance
  for (const script of scripts) {
    if (script.endsWith(".mjs") || script.includes("type=module")) {
      parts.push(`  <script type="module" src="${script}"></script>`);
    } else {
      parts.push(`  <script src="${script}"></script>`);
    }
  }

  parts.push("</body>");

  return parts.join("\n");
}

/**
 * Escape HTML special characters
 *
 * Prevents XSS by escaping user-provided content in attributes.
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
 * Inject Vite HMR client script (for development)
 *
 * Adds Vite's HMR client for hot module replacement in dev mode.
 *
 * @param html - HTML content
 * @param viteHost - Vite server host (e.g., "http://localhost:5173")
 * @returns HTML with HMR client injected
 */
export function injectViteHMR(html: string, viteHost: string = "http://localhost:5173"): string {
  const hmrScript = `
  <script type="module" src="${viteHost}/@vite/client"></script>
  `;

  // Inject after <head> tag
  return html.replace(/<head>/, `<head>${hmrScript}`);
}

/**
 * Apply base path to URLs in HTML
 *
 * Rewrites relative URLs to include the base path.
 * Useful when deploying to a subdirectory.
 *
 * @param html - HTML content
 * @param base - Base path (e.g., "/org-press")
 * @returns HTML with base path applied
 */
export function applyBasePath(html: string, base: string): string {
  if (!base || base === "/") return html;

  // Rewrite href and src attributes
  return html
    .replace(/href="\//g, `href="${base}/`)
    .replace(/src="\//g, `src="${base}/`)
    .replace(/href='\//g, `href='${base}/`)
    .replace(/src='\//g, `src='${base}/`);
}
