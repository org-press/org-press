/**
 * Org-Press 2 Dev Server
 *
 * SSR middleware for Vite dev server.
 * Renders .org files on-the-fly during development.
 */

import type { Connect, ViteDevServer } from "vite";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { OrgPressConfig, ThemeConfig } from "../config/types.ts";
import {
  collectCssFromModuleGraph,
  generateCssLinkTags,
} from "./css-collector.ts";

// Get the package root directory for resolving dev-entry path
// At runtime, this file is in dist/ but we need to resolve to src/node/dev-entry.tsx
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = __dirname.includes("/dist")
  ? path.resolve(__dirname, "..")  // Running from dist/, go up one level
  : path.resolve(__dirname, "../..");  // Running from src/node/, go up two levels

/**
 * Resolve theme configuration to a path string
 */
function resolveThemePath(theme: string | ThemeConfig | undefined): string {
  if (!theme) {
    return ".org-press/themes/index.tsx";
  }
  return typeof theme === "string" ? theme : theme.entry;
}

/**
 * Dev server options
 */
export interface DevServerOptions {
  /** Org-press configuration */
  config: OrgPressConfig;

  /** Vite dev server instance */
  server: ViteDevServer;
}

/**
 * Create SSR middleware for Vite dev server
 *
 * Handles requests for .org files and renders them on-the-fly.
 *
 * @param options - Dev server options
 * @returns Connect middleware
 *
 * @example
 * // vite.config.ts
 * export default {
 *   plugins: [
 *     {
 *       name: 'org-press:dev-server',
 *       configureServer(server) {
 *         const config = await loadConfig();
 *         return () => {
 *           server.middlewares.use(createDevServerMiddleware({ config, server }));
 *         };
 *       },
 *     },
 *   ],
 * };
 */
export function createDevServerMiddleware(
  options: DevServerOptions
): Connect.NextHandleFunction {
  const { config, server } = options;
  const contentDir = config.contentDir || "content";
  const base = config.base || "/";

  return async (req, res, next) => {
    // Only handle HTML requests
    if (!req.url) {
      return next();
    }

    // Remove base path if present
    let url = req.url;
    if (base !== "/" && url.startsWith(base)) {
      url = url.slice(base.length);
    }

    // Remove query string
    const urlWithoutQuery = url.split("?")[0];

    // Map URL to .org file
    // / → index.org
    // /about → about.org
    // /blog/post → blog/post.org
    let orgPath: string;
    if (urlWithoutQuery === "/" || urlWithoutQuery === "") {
      orgPath = path.join(contentDir, "index.org");
    } else {
      // Remove leading slash and .html extension if present
      const cleanPath = urlWithoutQuery.replace(/^\//, "").replace(/\.html$/, "");
      orgPath = path.join(contentDir, `${cleanPath}.org`);
    }

    // Check if .org file exists
    if (!fs.existsSync(orgPath)) {
      return next();
    }

    try {
      const html = await renderOrgFile(orgPath, { config, server });

      // Transform HTML with Vite (resolves virtual modules, etc.)
      const transformedHtml = await server.transformIndexHtml(
        req.url,
        html,
        req.originalUrl
      );

      res.setHeader("Content-Type", "text/html");
      res.statusCode = 200;
      res.end(transformedHtml);
    } catch (error: any) {
      // Handle error
      console.error(`[org-press:dev] Error rendering ${orgPath}:`, error);

      res.setHeader("Content-Type", "text/html");
      res.statusCode = 500;
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body {
                font-family: system-ui;
                padding: 2rem;
                max-width: 800px;
                margin: 0 auto;
              }
              pre {
                background: #f5f5f5;
                padding: 1rem;
                overflow-x: auto;
              }
            </style>
          </head>
          <body>
            <h1>Error rendering page</h1>
            <p><strong>File:</strong> ${orgPath}</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack || ""}</pre>
          </body>
        </html>
      `);
    }
  };
}

/**
 * Render .org file for dev server
 *
 * @param orgPath - Path to .org file
 * @param options - Render options
 * @returns Rendered HTML
 */
async function renderOrgFile(
  orgPath: string,
  options: DevServerOptions
): Promise<string> {
  const { config, server } = options;

  // Load plugins
  const { loadPlugins } = await import("../plugins/loader.ts");
  const { plugins } = await loadPlugins(config);

  // Load dev entry module via Vite SSR
  // Use source path from package root (Vite needs to transform TSX)
  const devEntryPath = path.resolve(packageRoot, "src/node/dev-entry.tsx");
  const devEntry = await server.ssrLoadModule(devEntryPath);

  // Render using the dev entry
  const { html: renderedHtml, collectedBlocks } = await devEntry.renderOrgFile({
    config,
    plugins,
    orgPath,
  });

  // Collect CSS from module graph and inject link tags
  // This mimics what Vite does in production builds
  const themePath = resolveThemePath(config.theme);
  const absoluteThemePath = path.resolve(process.cwd(), themePath);

  // Check if custom theme exists, otherwise use default layout path
  let cssSourcePath = absoluteThemePath;
  if (!fs.existsSync(absoluteThemePath)) {
    // Use default layout CSS from the package
    cssSourcePath = path.resolve(packageRoot, "src/layouts/default/Layout.tsx");
  }
  const cssUrls = collectCssFromModuleGraph(server, cssSourcePath);

  // If no CSS found in module graph (e.g., default layout not yet loaded),
  // inject the default CSS directly
  if (cssUrls.length === 0 && !fs.existsSync(absoluteThemePath)) {
    // Add default layout CSS path for Vite to serve
    const defaultCssPath = path.resolve(packageRoot, "src/layouts/default/index.css");
    if (fs.existsSync(defaultCssPath)) {
      cssUrls.push(`/@fs${defaultCssPath}`);
    }
  }

  let htmlWithCss = renderedHtml;
  if (cssUrls.length > 0) {
    const linkTags = generateCssLinkTags(cssUrls);
    // Inject CSS links before </head>
    if (htmlWithCss.includes("</head>")) {
      htmlWithCss = htmlWithCss.replace("</head>", `  ${linkTags}\n</head>`);
    }
  }

  // Inject Vite client for HMR
  const htmlWithVite = injectViteClient(htmlWithCss);

  // Inject hydration support for interactive blocks
  const htmlWithHydration = injectDevHydration(htmlWithVite, collectedBlocks, config);

  return `<!DOCTYPE html>\n${htmlWithHydration}`;
}

/**
 * Inject Vite client script for HMR
 *
 * @param html - Rendered HTML
 * @returns HTML with Vite client injected
 */
function injectViteClient(html: string): string {
  // Inject Vite client script into <head>
  const viteScript = '<script type="module" src="/@vite/client"></script>';

  // Find </head> tag and inject before it
  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${viteScript}\n</head>`);
  }

  // Fallback: inject at the beginning
  return viteScript + "\n" + html;
}

/**
 * Collected block info (matches dev-entry.tsx export)
 */
interface CollectedBlockInfo {
  id: string;
  containerId: string;
  cachePath: string;
  name?: string;
  language: string;
  modeName?: string;
}

/**
 * Inject hydration support for dev mode
 *
 * Uses collected blocks from the render to build the manifest:
 * 1. Manifest mapping block IDs to cache file paths (served by Vite)
 * 2. Hydrate script (loaded via Vite)
 *
 * @param html - Rendered HTML
 * @param collectedBlocks - Blocks collected during rendering
 * @param config - Org-press config
 * @returns HTML with hydration support
 */
function injectDevHydration(
  html: string,
  collectedBlocks: CollectedBlockInfo[],
  config: OrgPressConfig
): string {
  // No blocks, no hydration needed
  if (!collectedBlocks || collectedBlocks.length === 0) {
    return html;
  }

  // Build manifest using cache file paths
  // Vite serves these directly and handles TypeScript transformation
  const manifest: Record<string, { src: string; language?: string; modeName?: string }> = {};

  for (const block of collectedBlocks) {
    // Convert absolute cache path to URL path relative to project root
    const relativePath = path.relative(process.cwd(), block.cachePath);
    // Use Vite's /@fs/ prefix for absolute paths, or just / for relative
    const src = "/" + relativePath.replace(/\\/g, "/");

    manifest[block.id] = { src, language: block.language, modeName: block.modeName };
  }

  // Generate manifest script
  const manifestScript = `<script>window.__ORG_PRESS_MANIFEST__=${JSON.stringify(manifest)};</script>`;

  // Hydrate script - use source path for Vite to transform
  // In dev mode, resolve from src/client/hydrate.ts
  // __dirname is dist/node/ in built package, but we need src path for Vite
  const hydratePath = path.resolve(packageRoot, "src/client/hydrate.ts");
  const hydrateScript = `<script type="module" src="/@fs${hydratePath.replace(/\\/g, '/')}"></script>`;

  // Inject before </body>
  if (html.includes("</body>")) {
    return html.replace(
      "</body>",
      `${manifestScript}\n  ${hydrateScript}\n</body>`
    );
  }

  // Fallback: append at end
  return html + manifestScript + "\n" + hydrateScript;
}
