import type {
  SSRRenderOptions,
  LayoutComponent,
  LayoutProps,
} from "./types.ts";
import { renderOrg } from "./render.ts";

// React SSR is optional - required for layout rendering
// Lazily loaded to avoid requiring React when not using layouts
let React: typeof import("react") | null = null;
let ReactDOMServer: typeof import("react-dom/server") | null = null;
let reactLoadError: Error | null = null;

// Try to load React - it's required for layout rendering
try {
  React = await import("react");
  ReactDOMServer = await import("react-dom/server");
} catch (e) {
  reactLoadError = e instanceof Error ? e : new Error(String(e));
}

function ensureReact(): void {
  if (!React || !ReactDOMServer) {
    throw new Error(
      "React is required for renderWithLayout. " +
        "Install react and react-dom, or use renderOrg for layouts that don't need React. " +
        (reactLoadError ? `Original error: ${reactLoadError.message}` : "")
    );
  }
}

/**
 * SSR rendering with layout application
 *
 * Takes rendered HTML content and wraps it with a React layout component.
 * Used for static site generation and server-side rendering.
 */

/**
 * Render org content with layout (SSR)
 *
 * Process:
 * 1. Render AST to HTML (if not already rendered)
 * 2. Inject HTML into layout component
 * 3. Render React to string
 *
 * @param options - SSR render options
 * @returns Rendered HTML with layout applied
 *
 * @example
 * // In build layer:
 * const parsed = await parseOrgContent(source, parseContext);
 *
 * const html = await renderWithLayout({
 *   ast: parsed.ast,
 *   context: {
 *     base: "/",
 *     metadata: parsed.metadata,
 *   },
 *   Layout: MyLayoutComponent,
 * });
 */
export async function renderWithLayout(
  options: SSRRenderOptions
): Promise<string> {
  // Ensure React is available for layout rendering
  ensureReact();

  // Render AST to HTML if needed (includes TOC extraction)
  const { html: contentHtml, toc } = await renderOrg(
    options.ast,
    options.context
  );

  // Get layout component (use default if not provided)
  const Layout = options.Layout || DefaultLayout;

  // Prepare layout props
  // Current interface (children + metadata) with legacy interface (content + title/date) for backward compatibility
  const layoutProps: LayoutProps = {
    // Current interface
    children: React!.createElement("div", {
      dangerouslySetInnerHTML: { __html: contentHtml },
    }),
    metadata: options.context.metadata,
    base: options.context.base,
    toc, // Pass extracted TOC to layout

    // Legacy interface for backward compatibility
    content: contentHtml,
    title: options.context.metadata.title,
    date: options.context.metadata.date,

    ...options.layoutProps,
  };

  // Render with React SSR
  const renderedHtml = ReactDOMServer!.renderToString(
    React!.createElement(React!.StrictMode, null, React!.createElement(Layout, layoutProps))
  );

  return renderedHtml;
}

/**
 * Default layout component
 *
 * Basic HTML structure when no custom layout is provided.
 * Useful for testing and simple use cases.
 */
function DefaultLayout({ children, metadata, base }: LayoutProps): React.ReactElement {
  // React is guaranteed to be available here since this is only called from renderWithLayout
  const h = React!.createElement;

  return h(
    "html",
    { lang: "en" },
    h(
      "head",
      null,
      h("meta", { charSet: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      h("title", null, metadata.title || "Org-Press"),
      metadata.author && h("meta", { name: "author", content: metadata.author }),
      metadata.date && h("meta", { name: "date", content: metadata.date }),
      h("base", { href: base })
    ),
    h("body", null, h("main", null, children))
  );
}

/**
 * Deduplicate CSS links in HTML
 *
 * Removes duplicate <link rel="stylesheet"> tags, keeping the first occurrence.
 * Useful when Vite auto-injects links that are already in the layout.
 *
 * @param html - HTML string potentially containing duplicate links
 * @returns HTML with duplicates removed
 *
 * @example
 * const cleaned = deduplicateCssLinks(html);
 */
export function deduplicateCssLinks(html: string): string {
  const linkRegex = /<link\s+([^>]*?)\s*\/?>/g;
  const seenHrefs = new Set<string>();
  const linksToRemove: string[] = [];

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const attributes = match[1];

    // Check if this is a stylesheet link
    if (attributes.includes('rel="stylesheet"')) {
      // Extract href
      const hrefMatch = attributes.match(/href=["']([^"']+)["']/);
      if (hrefMatch) {
        const href = hrefMatch[1];

        // If we've seen this href before, mark for removal
        if (seenHrefs.has(href)) {
          linksToRemove.push(fullTag);
        } else {
          seenHrefs.add(href);
        }
      }
    }
  }

  // Remove duplicate links
  let result = html;
  for (const tag of linksToRemove) {
    result = result.replace(tag, "");
  }

  return result;
}

/**
 * Render preload links for assets
 *
 * Generates <link rel="modulepreload"> and <link rel="stylesheet"> tags
 * based on Vite's build manifest.
 *
 * @param modules - Module IDs to preload
 * @param manifest - Vite build manifest (module ID → assets)
 * @returns HTML string with link tags
 *
 * @example
 * const preloadLinks = renderPreloadLinks(
 *   ["entry-client.js"],
 *   manifest
 * );
 */
export function renderPreloadLinks(
  modules: string[],
  manifest: Record<string, string[]>
): string {
  let links = "";
  const seen = new Set<string>();

  for (const id of modules) {
    const files = manifest[id];
    if (!files) continue;

    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);

      // Render link for this file
      links += renderPreloadLink(file);

      // Also include dependencies (recursively)
      const basename = file.split("/").pop() || "";
      const deps = manifest[basename];
      if (deps) {
        for (const depFile of deps) {
          if (!seen.has(depFile)) {
            seen.add(depFile);
            links += renderPreloadLink(depFile);
          }
        }
      }
    }
  }

  return links;
}

/**
 * Render a single preload link based on file type
 *
 * @param file - File path
 * @returns HTML link tag
 */
function renderPreloadLink(file: string): string {
  if (file.endsWith(".js")) {
    return `<link rel="modulepreload" crossorigin href="${file}">`;
  } else if (file.endsWith(".css")) {
    return `<link rel="stylesheet" href="${file}">`;
  } else if (file.endsWith(".woff")) {
    return `<link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`;
  } else if (file.endsWith(".woff2")) {
    return `<link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
  } else if (file.endsWith(".gif")) {
    return `<link rel="preload" href="${file}" as="image" type="image/gif">`;
  } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
    return `<link rel="preload" href="${file}" as="image" type="image/jpeg">`;
  } else if (file.endsWith(".png")) {
    return `<link rel="preload" href="${file}" as="image" type="image/png">`;
  }

  return "";
}
