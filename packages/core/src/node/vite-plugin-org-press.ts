/**
 * Org-Press 2 Vite Plugin
 *
 * Main plugin for integrating org-press with Vite.
 * Uses the new unified architecture with dependency injection.
 */

import type { Plugin } from "vite";
import type { OrgPressConfig } from "../config/types.ts";
import { loadConfig, invalidateConfigCache } from "../config/loader.ts";
import { loadPlugins, invalidatePluginCache } from "../plugins/loader.ts";
import { createVirtualBlocksPlugin } from "./plugins/virtual-blocks.ts";
import { createApiMiddleware } from "../plugins/builtin/api/index.ts";
import { initializeRenderApi } from "../plugins/preview-init.ts";

/**
 * Plugin options (can override config file)
 */
export interface OrgPressPluginOptions extends Partial<OrgPressConfig> {
  /**
   * Custom config path (e.g., '.org-press/config.shop.ts')
   * Defaults to '.org-press/config.ts'
   */
  configPath?: string;
}

/**
 * Create org-press Vite plugins
 *
 * Returns an array of plugins that handle:
 * - .org file transformation
 * - Virtual module blocks
 * - HMR for org files
 *
 * @param userOptions - Plugin options (can override config file)
 * @returns Array of Vite plugins
 *
 * @example
 * // vite.config.ts
 * import { orgPress } from 'org-press';
 *
 * export default {
 *   plugins: [
 *     ...(await orgPress()),
 *   ],
 * };
 */
export async function orgPress(
  userOptions: OrgPressPluginOptions = {}
): Promise<Plugin[]> {
  // Load config from file
  const configFromFile = await loadConfig(
    userOptions.configPath || ".org-press/config.ts"
  );

  // Merge user options (take precedence over config file)
  const config: OrgPressConfig = {
    ...configFromFile,
    ...userOptions,
  };

  // Load plugins (including presets, user plugins, org plugins, and built-ins)
  const { plugins } = await loadPlugins(config);

  // Initialize render API (registers built-in wrappers like withTabs, withSourceCode)
  initializeRenderApi();

  return createOrgPressPlugins(config, plugins);
}

/**
 * Create org-press Vite plugins from a resolved config
 *
 * Synchronous version for internal use when config and plugins are already loaded.
 *
 * @param config - Resolved org-press configuration
 * @param plugins - Loaded block plugins
 * @returns Array of Vite plugins
 */
export function createOrgPressPlugins(
  config: OrgPressConfig,
  plugins: any[]
): Plugin[] {
  const vitePlugins: Plugin[] = [
    transformOrgModePlugin(config),
  ];

  // Add virtual blocks plugin if there are plugins configured
  if (plugins && plugins.length > 0) {
    // Virtual blocks plugin will have its command/mode set in configResolved hook
    const virtualBlocksPlugin = createVirtualBlocksPlugin(plugins, {
      command: "serve",
      mode: "development",
      config, // Pass the full config object
    });

    // Note: command/mode are set when the plugin is created
    // In a real implementation, you might want to recreate the plugin
    // based on Vite's resolved config in the configResolved hook

    vitePlugins.unshift(virtualBlocksPlugin);
  }

  return vitePlugins;
}

/**
 * Plugin to transform .org files on-the-fly during dev
 *
 * Responsibilities:
 * - Mark .org files as modules (placeholder export)
 * - Watch content directory for changes
 * - Trigger HMR for .org file changes
 * - Register API middleware for :use api blocks
 */
function transformOrgModePlugin(
  config: OrgPressConfig
): Plugin {
  return {
    name: "org-press:transform",
    enforce: "pre",

    // Add aliases and esbuild config for org-press
    config() {
      return {
        esbuild: {
          // Use automatic JSX runtime (React 17+)
          jsx: "automatic",
          jsxImportSource: "react",
        },
        optimizeDeps: {
          // Include React JSX runtime to ensure proper ESM exports
          include: [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
          ],
          // Exclude native modules that shouldn't be bundled for the browser
          exclude: ["fsevents"],
        },
        build: {
          rollupOptions: {
            // Mark native modules as external
            external: ["fsevents"],
          },
        },
        ssr: {
          // Externalize React during SSR - let Node.js handle CommonJS require natively
          // This prevents "module is not defined" errors from React's CJS jsx-runtime
          external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
        },
      };
    },

    transform(code: string, id: string) {
      // Don't actually transform .org files - they're processed server-side
      // This is just for module import compatibility
      // IMPORTANT: Only handle .org files WITHOUT query parameters
      // Files with query params (e.g., .org?name=block) are handled by virtual-blocks plugin
      if (id.endsWith(".org") && !id.includes("?")) {
        return {
          code: `export default "org-module-placeholder";`,
          map: null,
        };
      }
      return null;
    },

    handleHotUpdate({ server, modules, timestamp }) {
      // Check if any of the modules are .org files
      const hasOrgFile = modules.some((mod) => mod.file?.endsWith(".org"));

      if (hasOrgFile) {
        // Trigger full reload for .org file changes
        // This ensures the SSR-rendered content is re-fetched
        for (const mod of modules) {
          server.moduleGraph.invalidateModule(mod);
        }
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: "full-reload" });
        return [];
      }

      // Let Vite handle other file types normally
      return modules;
    },

    // Configure Vite to watch content directory and register SSR middleware
    async configureServer(server) {
      const contentDir = config.contentDir || "content";

      // Add content directory to file watcher
      const contentPattern = `${contentDir}/**/*.org`;
      server.watcher.add(contentPattern);

      // Listen for .org file changes and additions, trigger HMR
      const handleOrgFileChange = (file: string) => {
        if (file.endsWith(".org")) {
          // Invalidate caches
          invalidateConfigCache();
          invalidatePluginCache();

          // Invalidate all modules to ensure fresh SSR render
          server.moduleGraph.invalidateAll();

          // Send full reload to all connected clients
          if (server.ws.clients.size > 0) {
            server.ws.send({
              type: "full-reload",
              path: "*",
            });
          }
        }
      };

      server.watcher.on("change", handleOrgFileChange);
      server.watcher.on("add", handleOrgFileChange);

      // Log when server is ready
      server.httpServer?.once("listening", () => {
        console.log(`[org-press] Watching ${contentDir}/ for changes`);
      });

      // Register API middleware for :use api blocks
      // This must be installed BEFORE other middlewares to handle API routes first
      server.middlewares.use(createApiMiddleware());

      // Register SSR middleware for rendering .org files
      // Import dev server middleware
      const { createDevServerMiddleware } = await import("./dev-server.ts");

      // Install middleware BEFORE Vite's internal middlewares
      // This ensures we can handle .org routes before Vite's SPA fallback
      server.middlewares.use(createDevServerMiddleware({ config, server }));
    },
  };
}

/**
 * Get Vite optimizeDeps configuration for org-press
 *
 * Include cache directory files and layout directories for dependency optimization.
 *
 * @param config - Org-press configuration
 * @returns Vite optimizeDeps configuration
 */
export function getOptimizeDepsConfig(config: OrgPressConfig) {
  const cacheDir = config.cacheDir || ".org-press-cache";

  return {
    entries: [
      `${cacheDir}/**/*.{js,jsx,ts,tsx,css}`,
      // Include user theme directory for optimization
      ".org-press/theme/**/*.{js,jsx,ts,tsx}",
    ],
  };
}
