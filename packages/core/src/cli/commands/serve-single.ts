/**
 * Serve Single File Module
 *
 * Serves a single org file as a web page with hot reload support.
 * Uses Vite under the hood for HMR capabilities.
 */

import { createServer, type ViteDevServer } from "vite";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Connect } from "vite";
import type { OrgPressConfig } from "../../config/types.ts";
import type { BlockPlugin } from "../../plugins/types.ts";
import { loadPlugins } from "../../plugins/loader.ts";
import { createVirtualBlocksPlugin } from "../../node/plugins/virtual-blocks.ts";
import { createApiMiddleware, registerApiRoute } from "../../plugins/builtin/api/index.ts";
import { parseApiBlockParams, validateEndpoint, normalizeMethod } from "../../plugins/builtin/api/utils.ts";
import type { ApiRouteDefinition } from "../../plugins/builtin/api/types.ts";

// Get the package root directory for resolving dev-entry path
// Works for local installs, global installs, and development
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findPackageRoot(): string {
  // Walk up from __dirname until we find package.json with name "org-press"
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "org-press") {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = path.dirname(dir);
  }

  // Fallback to the old calculation
  return __dirname.includes("/dist")
    ? path.resolve(__dirname, "../..")
    : path.resolve(__dirname, "../../..");
}

const packageRoot = findPackageRoot();

/**
 * Options for serving a single org file
 */
export interface ServeSingleOptions {
  /** Path to the org file to serve */
  file: string;
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Open browser on start */
  open?: boolean;
}

/**
 * Server instance returned by serveSingleFile
 */
export interface ServeSingleServer {
  /** Port the server is listening on */
  port: number;
  /** Close the server */
  close: () => Promise<void>;
}

/**
 * Create a minimal org-press config for single file serving
 *
 * Uses the minimal layout (no header/footer) which is ideal for
 * single-file hashbang mode and standalone pages.
 */
function createMinimalConfig(orgFilePath: string): OrgPressConfig {
  const orgDir = path.dirname(orgFilePath);

  return {
    contentDir: orgDir,
    outDir: "dist",
    base: "/",
    cacheDir: "node_modules/.org-press-cache",
    plugins: [],
    // Use minimal layout for single-file mode (no header/footer)
    theme: "org-press:minimal",
    buildConcurrency: 1,
    uniorg: {},
    vite: {},
    defaultUse: "preview",
    languageDefaults: {},
  };
}

/**
 * Compile handler code into an async function
 */
function compileHandler(code: string): (req: any, res: any) => Promise<void> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  // Wrap code to handle export default pattern
  const wrappedCode = `
    const __module = { exports: {} };
    const module = __module;
    const exports = __module.exports;

    ${code}

    // Get the handler from export default or module.exports.default
    const handler = typeof __module.exports.default === 'function'
      ? __module.exports.default
      : (typeof __module.exports === 'function' ? __module.exports : null);

    if (!handler) {
      throw new Error('API handler must export a default function');
    }

    return handler(arguments[0], arguments[1]);
  `;

  const fn = new AsyncFunction(wrappedCode);
  return async (req, res) => {
    await fn(req, res);
  };
}

/**
 * Extract and register API routes from a single org file
 */
function registerApiRoutesFromFile(orgFilePath: string): number {
  const content = fs.readFileSync(orgFilePath, "utf-8");
  let routeCount = 0;

  // Parse code blocks looking for :use api
  const blockRegex = /^#\+begin_src\s+(\w+)\s*(.*?)$([\s\S]*?)^#\+end_src$/gim;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    const params = match[2];
    const code = match[3].trim();

    // Check for :use api
    const useMatch = params.match(/:use\s+api/);
    if (!useMatch) continue;

    // Parse API block parameters
    const apiParams = parseApiBlockParams(params);

    // Validate endpoint
    const endpointError = validateEndpoint(apiParams.endpoint);
    if (endpointError) {
      console.warn(`[serve-single] Invalid API endpoint: ${endpointError}`);
      continue;
    }

    try {
      const handler = compileHandler(code);
      const route: ApiRouteDefinition = {
        endpoint: apiParams.endpoint,
        method: normalizeMethod(apiParams.method),
        handler,
        previewOnly: apiParams.previewOnly,
        sourcePath: orgFilePath,
        blockName: apiParams.name,
      };

      registerApiRoute(route);
      routeCount++;
    } catch (error: any) {
      console.error(`[serve-single] Failed to compile API handler: ${error.message}`);
    }
  }

  return routeCount;
}

/**
 * Create SSR middleware for rendering a single org file
 */
function createSingleFileMiddleware(
  orgFilePath: string,
  config: OrgPressConfig,
  plugins: BlockPlugin[],
  server: ViteDevServer
): Connect.NextHandleFunction {
  const orgFileName = path.basename(orgFilePath);

  return async (req, res, next) => {
    // Only handle root path requests for HTML
    if (!req.url) {
      return next();
    }

    const urlWithoutQuery = req.url.split("?")[0];

    // Serve the org file at root path
    if (urlWithoutQuery !== "/" && urlWithoutQuery !== "") {
      return next();
    }

    try {
      const html = await renderSingleOrgFile(orgFilePath, config, plugins, server);

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
      console.error(`[serve-single] Error rendering ${orgFileName}:`, error);

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
            <p><strong>File:</strong> ${orgFilePath}</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack || ""}</pre>
          </body>
        </html>
      `);
    }
  };
}

/**
 * Resolve the path to hydrate.ts for client-side hydration
 * Works in both development (src/) and production (dist/) environments
 */
function resolveHydratePath(): string {
  // In production, files are copied to dist/client/ (still .ts, Vite transforms)
  const prodPath = path.resolve(packageRoot, "dist/client/hydrate.ts");
  if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  // In development, files are in src/client/
  const devPath = path.resolve(packageRoot, "src/client/hydrate.ts");
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  throw new Error(
    `Could not find hydrate module. Tried:\n` +
    `  - ${prodPath}\n` +
    `  - ${devPath}`
  );
}

/**
 * Resolve the path to dev-entry for SSR loading
 * Works in both development (src/) and production (dist/) environments
 */
function resolveDevEntryPath(): string {
  // In production, files are in dist/node/
  const prodPath = path.resolve(packageRoot, "dist/node/dev-entry.js");
  if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  // In development, files are in src/node/
  const devPath = path.resolve(packageRoot, "src/node/dev-entry.tsx");
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fallback - try relative to __dirname which is in dist/cli/commands/
  const relativePath = path.resolve(__dirname, "../../node/dev-entry.js");
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  throw new Error(
    `Could not find dev-entry module. Tried:\n` +
    `  - ${prodPath}\n` +
    `  - ${devPath}\n` +
    `  - ${relativePath}`
  );
}

/**
 * Collected block info (matches dev-entry.tsx export)
 */
interface CollectedBlockInfo {
  id: string;
  containerId: string;
  cachePath: string;
  /** Virtual module ID for Vite resolution */
  virtualModuleId: string;
  name?: string;
  language: string;
  modeName?: string;
}

/**
 * Inject hydration support for dev mode
 *
 * Uses collected blocks from the render to build the manifest:
 * 1. Manifest mapping block IDs to virtual module IDs (Vite resolves these)
 * 2. Hydrate script (loaded via Vite)
 *
 * In dev mode, we use virtual module IDs which Vite resolves dynamically.
 * This enables HMR support while keeping the same module structure as production.
 *
 * @param html - Rendered HTML
 * @param collectedBlocks - Blocks collected during rendering
 * @returns HTML with hydration support
 */
function injectDevHydration(
  html: string,
  collectedBlocks: CollectedBlockInfo[]
): string {
  // No blocks, no hydration needed
  if (!collectedBlocks || collectedBlocks.length === 0) {
    return html;
  }

  // Build manifest using virtual module IDs
  // Vite resolves these to the actual transformed code
  const manifest: Record<string, { src: string; language?: string; modeName?: string }> = {};

  for (const block of collectedBlocks) {
    // Use virtual module ID if available, fall back to cache path for backwards compatibility
    let src: string;
    if (block.virtualModuleId) {
      // Format virtual module URL for Vite dev server
      // Vite uses /@id/ prefix for virtual modules, and \0 becomes __x00__ in URLs
      src = "/@id/__x00__" + block.virtualModuleId;
    } else {
      // Fallback: convert absolute cache path to URL path relative to project root
      const relativePath = path.relative(process.cwd(), block.cachePath);
      src = "/" + relativePath.replace(/\\/g, "/");
    }

    manifest[block.id] = { src, language: block.language, modeName: block.modeName };
  }

  // Generate manifest script
  const manifestScript = `<script>window.__ORG_PRESS_MANIFEST__=${JSON.stringify(manifest)};</script>`;

  // Hydrate script - resolve to correct path (dist in production, src in development)
  const hydratePath = resolveHydratePath();
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

/**
 * Load CSS from the default layout (using packageRoot for reliable path resolution)
 */
function loadDefaultCSS(): string {
  // Try dist path first (production), then src path (development)
  const paths = [
    path.join(packageRoot, "dist/layouts/default/css"),
    path.join(packageRoot, "src/layouts/default/css"),
  ];

  for (const cssDir of paths) {
    const stylesPath = path.join(cssDir, "styles.css");
    if (fs.existsSync(stylesPath)) {
      let css = fs.readFileSync(stylesPath, "utf-8");

      // Add optional CSS files
      const orgPath = path.join(cssDir, "org.css");
      const srcPath = path.join(cssDir, "src.css");

      if (fs.existsSync(orgPath)) {
        css += "\n" + fs.readFileSync(orgPath, "utf-8");
      }
      if (fs.existsSync(srcPath)) {
        css += "\n" + fs.readFileSync(srcPath, "utf-8");
      }

      return css;
    }
  }

  // Fallback minimal styles
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 50rem; margin: 0 auto; padding: 2rem 1rem; }
    h1 { margin-bottom: 1rem; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    code { font-family: ui-monospace, monospace; }
    a { color: #0366d6; }
  `;
}

// Cache CSS at module level
let cachedCSS: string | null = null;

function getCSS(): string {
  if (!cachedCSS) {
    cachedCSS = loadDefaultCSS();
  }
  return cachedCSS;
}

/**
 * Render a single org file to HTML using minimal mode (no React)
 *
 * Uses string templates for zero-config mode where React isn't installed.
 */
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

async function renderSingleOrgFileMinimal(
  orgFilePath: string,
  config: OrgPressConfig,
  plugins: BlockPlugin[]
): Promise<string> {
  const { parseOrgContent } = await import("../../parser/parse-content.ts");
  const { renderOrgToHtml } = await import("../../render/render.ts");
  const { relative } = await import("node:path");

  const orgContent = fs.readFileSync(orgFilePath, "utf-8");

  // Get relative path from project root for virtual modules
  const relativeOrgPath = relative(process.cwd(), orgFilePath);

  // Parse org content with full plugin processing
  const parseContext = {
    orgFilePath: relativeOrgPath,
    plugins,
    config,
    cacheDir: config.cacheDir,
    base: config.base,
    contentDir: config.contentDir,
    outDir: config.outDir,
  };

  const parsed = await parseOrgContent(orgContent, parseContext);

  // Render org AST to HTML (no React - uses unified/rehype)
  const contentHtml = await renderOrgToHtml(parsed.ast, {
    base: config.base,
    metadata: parsed.metadata,
  });

  const metadata = parsed.metadata;

  // Build minimal layout HTML (no React - uses string templates)
  const title = metadata.title || "Org-Press";
  const description = metadata.description;
  const css = getCSS();
  const base = config.base;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  ${base && base !== "/" ? `<base href="${escapeHtml(base)}">` : ""}
  <style>${css}</style>
</head>
<body>
  <main class="site-main">
    ${metadata.title ? `<h1 class="page-title">${escapeHtml(metadata.title)}</h1>` : ""}
    <div class="page-content">${contentHtml}</div>
  </main>
  <footer class="site-footer">
    <p>Powered by <a href="https://github.com/org-press/org-press">Org-Press</a></p>
  </footer>
</body>
</html>`;

  // Inject Vite client for HMR
  const htmlWithVite = injectViteClient(html);

  // Inject hydration support for interactive blocks
  return injectDevHydration(htmlWithVite, parsed.collectedBlocks);
}

/**
 * Render a single org file to HTML
 *
 * Uses minimal mode (no React) for org-press:minimal theme,
 * falls back to React-based rendering for other themes.
 */
async function renderSingleOrgFile(
  orgFilePath: string,
  config: OrgPressConfig,
  plugins: BlockPlugin[],
  server: ViteDevServer
): Promise<string> {
  // Use minimal rendering (no React) for zero-config mode
  if (config.theme === "org-press:minimal") {
    return renderSingleOrgFileMinimal(orgFilePath, config, plugins);
  }

  // Load dev entry module via Vite SSR (requires React)
  const devEntryPath = resolveDevEntryPath();
  const devEntry = await server.ssrLoadModule(devEntryPath);

  // Render using the dev entry
  // renderOrgFile returns { html: string, collectedBlocks: CollectedBlockInfo[] }
  const renderResult = await devEntry.renderOrgFile({
    config,
    plugins,
    orgPath: orgFilePath,
  });

  // Extract HTML and collected blocks from render result
  const renderedHtml = typeof renderResult === "string"
    ? renderResult
    : renderResult.html;
  const collectedBlocks = typeof renderResult === "string"
    ? []
    : (renderResult.collectedBlocks || []);

  // Inject Vite client for HMR
  const htmlWithVite = injectViteClient(renderedHtml);

  // Inject hydration support for interactive blocks
  const htmlWithHydration = injectDevHydration(htmlWithVite, collectedBlocks);

  return `<!DOCTYPE html>\n${htmlWithHydration}`;
}

/**
 * Inject Vite client script for HMR
 */
function injectViteClient(html: string): string {
  const viteScript = '<script type="module" src="/@vite/client"></script>';

  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${viteScript}\n</head>`);
  }

  return viteScript + "\n" + html;
}

/**
 * Serve a single org file as a web page
 *
 * Creates a Vite dev server configured to serve only the specified org file.
 * Supports hot reload when the file changes and handles API routes defined
 * in :use api or :use dom:api blocks.
 *
 * @param options - Server options
 * @returns Server instance with port and close method
 *
 * @example
 * const server = await serveSingleFile({
 *   file: "./demo.org",
 *   port: 3000,
 *   open: true,
 * });
 *
 * // Later...
 * await server.close();
 */
export async function serveSingleFile(
  options: ServeSingleOptions
): Promise<ServeSingleServer> {
  const { file, port = 3000, host = "localhost", open = false } = options;

  // Resolve the org file path
  const orgFilePath = path.isAbsolute(file)
    ? file
    : path.resolve(process.cwd(), file);

  // Verify file exists
  if (!fs.existsSync(orgFilePath)) {
    throw new Error(`File not found: ${orgFilePath}`);
  }

  // Create minimal config for single file
  const config = createMinimalConfig(orgFilePath);

  // Load plugins
  const { plugins } = await loadPlugins(config);

  // Register API routes from the org file
  const apiRouteCount = registerApiRoutesFromFile(orgFilePath);

  // Create Vite server with minimal configuration
  const server = await createServer({
    root: path.dirname(orgFilePath),
    server: {
      port,
      host,
      open,
      fs: {
        // Allow access to the org-press package for hydrate.js
        allow: [
          path.dirname(orgFilePath),
          packageRoot,
        ],
      },
      watch: {
        // Watch the specific org file
        ignored: (filePath: string) => {
          // Don't ignore the org file we're serving
          if (filePath === orgFilePath) return false;
          // Ignore node_modules
          if (filePath.includes("node_modules")) return true;
          return false;
        },
      },
    },
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
    },
    optimizeDeps: {
      // Only include React if user has it installed
      // Zero-config mode doesn't need React
      include: [],
    },
    ssr: {
      // Externalize React - user must install if they want React features
      external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    plugins: [
      // Virtual blocks plugin - resolves virtual:org-press:block:... imports
      createVirtualBlocksPlugin(plugins, { command: "serve", mode: "development", config }),
      {
        name: "org-press:serve-single",
        enforce: "pre",

        configureServer(viteServer) {
          // Watch the org file for changes
          viteServer.watcher.add(orgFilePath);

          // Handle file changes
          viteServer.watcher.on("change", (changedFile) => {
            if (changedFile === orgFilePath) {
              console.log(`[serve-single] File changed: ${path.basename(orgFilePath)}`);
              viteServer.moduleGraph.invalidateAll();
              viteServer.ws.send({ type: "full-reload" });
            }
          });

          // Register API middleware if we have routes
          if (apiRouteCount > 0) {
            console.log(`[serve-single] Registered ${apiRouteCount} API route(s)`);
            viteServer.middlewares.use(createApiMiddleware());
          }

          // Register SSR middleware for the org file
          // NOTE: Must be registered directly (not via return function) to run
          // BEFORE Vite's internal middleware which would otherwise return 404
          viteServer.middlewares.use(
            createSingleFileMiddleware(orgFilePath, config, plugins, viteServer)
          );
        },
      },
    ],
  });

  // Start the server
  await server.listen();

  const resolvedPort = server.config.server.port || port;

  console.log(`[serve-single] Serving ${path.basename(orgFilePath)}`);
  console.log(`[serve-single] http://${host}:${resolvedPort}/`);

  return {
    port: resolvedPort,
    close: async () => {
      await server.close();
    },
  };
}
