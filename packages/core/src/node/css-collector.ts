/**
 * CSS Collection Utility for Dev Server
 *
 * Collects CSS modules from Vite's module graph to inject as <link> tags
 * during SSR rendering in dev mode.
 */

import type { ViteDevServer, ModuleNode } from "vite";

/**
 * Collect all CSS modules imported by a given module (recursively)
 *
 * Uses Vite's module graph to find all CSS files that are dependencies
 * of the entry module. This mirrors what Vite does in production builds.
 *
 * @param server - Vite dev server instance
 * @param entryModule - Path to the entry module (e.g., theme file)
 * @returns Array of CSS URLs that can be used in <link> tags
 *
 * @example
 * const cssUrls = collectCssFromModuleGraph(server, "/path/to/theme/index.tsx");
 * // Returns: ["/@fs/path/to/theme/default.css", ...]
 */
export function collectCssFromModuleGraph(
  server: ViteDevServer,
  entryModule: string
): string[] {
  const cssUrls: string[] = [];
  const visited = new Set<string>();

  // Try to find the module in the graph by ID or URL
  const mod =
    server.moduleGraph.getModuleById(entryModule) ||
    server.moduleGraph.getModuleByUrl(entryModule);

  if (mod) {
    traverseModuleGraph(mod, visited, cssUrls);
  }

  return cssUrls;
}

/**
 * Recursively traverse the module graph to find CSS modules
 *
 * @param mod - Current module node
 * @param visited - Set of visited module IDs to avoid cycles
 * @param cssUrls - Array to collect CSS URLs
 */
function traverseModuleGraph(
  mod: ModuleNode,
  visited: Set<string>,
  cssUrls: string[]
): void {
  const id = mod.id || mod.url;
  if (!id || visited.has(id)) return;
  visited.add(id);

  // Check if this is a CSS module
  const cleanId = id.split("?")[0];
  if (isCssFile(cleanId)) {
    // Use the module's URL for dev server, or construct /@fs path for absolute paths
    const cssUrl = mod.url || `/@fs${id}`;
    if (!cssUrls.includes(cssUrl)) {
      cssUrls.push(cssUrl);
    }
  }

  // Recursively traverse imported modules
  for (const imported of mod.importedModules) {
    traverseModuleGraph(imported, visited, cssUrls);
  }
}

/**
 * Check if a file path is a CSS file
 *
 * @param filePath - File path to check
 * @returns True if the file is a CSS file
 */
export function isCssFile(filePath: string): boolean {
  return /\.css$/i.test(filePath);
}

/**
 * Generate HTML link tags for CSS URLs
 *
 * @param cssUrls - Array of CSS URLs
 * @returns HTML string with <link> tags
 *
 * @example
 * const linkTags = generateCssLinkTags(["/@fs/path/to/style.css"]);
 * // Returns: '<link rel="stylesheet" href="/@fs/path/to/style.css">'
 */
export function generateCssLinkTags(cssUrls: string[]): string {
  return cssUrls
    .map((url) => `<link rel="stylesheet" href="${url}">`)
    .join("\n  ");
}
