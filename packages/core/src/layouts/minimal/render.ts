/**
 * Minimal Layout Renderer (No React)
 *
 * String-based renderer for zero-config single-file mode.
 * Doesn't require React - uses template strings.
 */

import type { PageMetadata } from "../../config/types.ts";

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render content with minimal layout (no React)
 *
 * @param content - HTML content to wrap
 * @param metadata - Page metadata
 * @param base - Base URL path
 * @returns Complete HTML document
 */
export function renderMinimalLayout(
  content: string,
  metadata: PageMetadata,
  base: string = "/",
): string {
  const title = metadata.title || "Org-Press";
  const description = metadata.description;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  ${base && base !== "/" ? `<base href="${escapeHtml(base)}">` : ""}
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 50rem;
      margin: 0 auto;
      padding: 2rem 1rem;
      color: #1a1a1a;
      background: #fff;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #e5e5e5; background: #1a1a1a; }
      pre { background: #2a2a2a; }
      a { color: #6eb5ff; }
    }
    h1 { margin-top: 0; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.9em; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <main>
    ${metadata.title ? `<h1>${escapeHtml(metadata.title)}</h1>` : ""}
    <div class="content">${content}</div>
  </main>
  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.875rem; color: #666;">
    <p>Powered by <a href="https://github.com/org-press/org-press">Org-Press</a></p>
  </footer>
</body>
</html>`;
}
