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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = __dirname.includes("/dist")
  ? path.resolve(__dirname, "../..")
  : path.resolve(__dirname, "../../..");

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

  // Extract HTML from render result
  const renderedHtml = typeof renderResult === "string"
    ? renderResult
    : renderResult.html;

  // Inject Vite client for HMR
  const htmlWithVite = injectViteClient(renderedHtml);

  return `<!DOCTYPE html>\n${htmlWithVite}`;
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
 * in :use api or :use preview:api blocks.
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
          return () => {
            viteServer.middlewares.use(
              createSingleFileMiddleware(orgFilePath, config, plugins, viteServer)
            );
          };
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
