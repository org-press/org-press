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
 */
function createMinimalConfig(orgFilePath: string): OrgPressConfig {
  const orgDir = path.dirname(orgFilePath);

  return {
    contentDir: orgDir,
    outDir: "dist",
    base: "/",
    cacheDir: "node_modules/.org-press-cache",
    plugins: [],
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
      // Virtual module IDs are resolved by Vite's virtual-blocks plugin
      src = block.virtualModuleId;
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
 * Render a single org file to HTML
 */
async function renderSingleOrgFile(
  orgFilePath: string,
  config: OrgPressConfig,
  plugins: BlockPlugin[],
  server: ViteDevServer
): Promise<string> {
  // Load dev entry module via Vite SSR
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
      // Include React and its subpackages to ensure proper ESM exports
      // react-dom/client is needed for dynamic import in hydrate.ts
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    ssr: {
      // Externalize React during SSR - let Node.js handle CommonJS require natively
      // This prevents "module is not defined" errors from React's CJS jsx-runtime
      external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    plugins: [
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
