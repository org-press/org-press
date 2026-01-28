/**
 * Org-Press 2 SSR Entry Point for Static Generation
 *
 * This module is used during the build process to render pages server-side.
 * It loads the config, theme layout, and plugins, then exports a render function
 * that the build system calls for each route.
 *
 * NOTE: This file is copied to dist/node/ and used as a Vite SSR entry point.
 * It imports from 'org-press' package to ensure proper resolution of bundled code.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { OrgPressConfig, LayoutComponent, BlockPlugin } from "org-press";
import {
  getContentPages,
  getOrgFileFromUrl,
  loadConfig,
  loadPlugins,
  loadDefaultLayout,
  parseOrgContent,
  contentHelpers,
  renderOrgToHtml,
  hasOrgLayout,
  hasOrgWrapper,
  hasThemeLayout,
  getThemeLayoutName,
  renderWithOrgLayout,
  hasCrossFileLayout,
  hasCrossFileWrapper,
  renderWithOrgLayoutAsync,
  renderWithLayout,
} from "org-press";

// Re-export for server-side execution blocks
export { getContentPages };

/**
 * Cached state (loaded once on first render)
 */
let cachedConfig: OrgPressConfig | null = null;
let cachedLayout: LayoutComponent | null = null;
let cachedThemeModule: any = null;
let cachedPlugins: BlockPlugin[] | null = null;

/**
 * Initialize config, layout, and plugins (called once on first render)
 *
 * Loads from environment variables set during SSR build.
 */
async function initialize(): Promise<void> {
  if (cachedConfig && cachedLayout && cachedPlugins) {
    return; // Already initialized
  }

  // Load config
  const configPath =
    process.env.ORG_PRESS_CONFIG_PATH || ".org-press/config.ts";
  cachedConfig = await loadConfig(configPath);

  // Load plugins
  const { plugins } = await loadPlugins(cachedConfig);
  cachedPlugins = plugins;

  // Load layout
  // Try to import theme from #theme alias (Vite bundles this during SSR build)
  try {
    // @ts-expect-error - #theme is a Vite alias resolved during build
    const themeModule = await import("#theme");
    cachedThemeModule = themeModule;

    // Support multiple export patterns
    if (themeModule.getLayout && typeof themeModule.getLayout === "function") {
      cachedLayout = themeModule.getLayout("default");
    } else if (themeModule.layouts && themeModule.layouts.default) {
      cachedLayout = themeModule.layouts.default;
    } else if (themeModule.default) {
      cachedLayout = themeModule.default;
    } else {
      throw new Error("No valid layout export found in theme");
    }
  } catch (error) {
    // Fallback to default layout if theme import fails
    console.warn("[entry-generate] Failed to load theme from #theme alias, using default");
    cachedLayout = await loadDefaultLayout();
  }
}

/**
 * Get a specific layout from the theme by name
 *
 * @param layoutName - Name of the layout to get
 * @returns Layout component or default layout if not found
 */
function getLayoutByName(layoutName: string): LayoutComponent {
  if (!cachedThemeModule) {
    return cachedLayout!;
  }

  // Try getLayout function
  if (cachedThemeModule.getLayout && typeof cachedThemeModule.getLayout === "function") {
    const layout = cachedThemeModule.getLayout(layoutName);
    if (layout) return layout;
  }

  // Try layouts object
  if (cachedThemeModule.layouts && cachedThemeModule.layouts[layoutName]) {
    return cachedThemeModule.layouts[layoutName];
  }

  // Fallback to default
  return cachedLayout!;
}

/**
 * Collected block info for hydration
 */
export interface CollectedBlockInfo {
  id: string;
  containerId: string;
  cachePath: string;
  name?: string;
  language: string;
  modeName?: string;
}

/**
 * Render result
 */
export interface RenderResult {
  html: string | null;
  preloadLinks: string;
  collectedBlocks: CollectedBlockInfo[];
}

/**
 * Render a page for the given URL
 *
 * Called by the build system for each route during static generation.
 *
 * @param url - URL path to render (e.g., "/", "/about", "/blog/post")
 * @param _manifest - Vite build manifest (not currently used)
 * @returns Rendered HTML, preload links, and collected blocks for hydration
 *
 * @example
 * const { html, collectedBlocks } = await render("/about", {});
 */
export async function render(
  url: string,
  _manifest: Record<string, string[]>
): Promise<RenderResult> {
  // Initialize on first call
  await initialize();

  const config = cachedConfig!;
  const Layout = cachedLayout!;
  const plugins = cachedPlugins!;

  // Find org file for this URL
  const orgFile = getOrgFileFromUrl(url, config.contentDir);

  if (!orgFile) {
    console.warn(`[entry-generate] Org file not found for URL: ${url}`);
    return { html: null, preloadLinks: "", collectedBlocks: [] };
  }

  if (!existsSync(orgFile)) {
    console.warn(`[entry-generate] Org file does not exist: ${orgFile}`);
    return { html: null, preloadLinks: "", collectedBlocks: [] };
  }

  // Read org file
  const orgContent = await readFile(orgFile, "utf-8");

  // Get relative path from PROJECT ROOT (not content dir)
  // Virtual blocks plugin expects paths relative to project root
  const relativeOrgPath = relative(process.cwd(), orgFile);

  // Parse org content
  const parseContext = {
    orgFilePath: relativeOrgPath,
    plugins,
    config,
    cacheDir: config.cacheDir,
    base: config.base,
    contentDir: config.contentDir,
    outDir: config.outDir,
  };

  // Parse with full content helpers (imported from content.ts)
  const parsed = await parseOrgContent(orgContent, parseContext, contentHelpers);

  // Check for cross-file layout/wrapper (#+LAYOUT: ./path.org#block)
  if (hasCrossFileLayout(parsed.metadata) || hasCrossFileWrapper(parsed.metadata)) {
    const absoluteOrgPath = resolve(process.cwd(), orgFile);
    const contentDirAbsolute = resolve(process.cwd(), config.contentDir);

    const { html: orgHtml, hasLayout } = await renderWithOrgLayoutAsync(
      parsed.ast,
      parsed.metadata,
      async (ast) => {
        return renderOrgToHtml(ast, {
          base: config.base,
          metadata: parsed.metadata,
        });
      },
      {
        currentOrgFile: absoluteOrgPath,
        contentDir: contentDirAbsolute,
        devMode: false, // Build mode
      }
    );

    // If cross-file layout was found, use it directly
    if (hasLayout) {
      const html = `<!DOCTYPE html>\n${orgHtml}`;
      return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
    }

    // Cross-file wrapper but no layout - apply theme layout to wrapped content
    const themeLayoutName = getThemeLayoutName(parsed.metadata);
    const LayoutToUse = themeLayoutName ? getLayoutByName(themeLayoutName) : Layout;

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout: LayoutToUse,
      layoutProps: {
        content: orgHtml,
        currentPath: url,
      },
    });

    const html = `<!DOCTYPE html>\n${renderedHtml}`;
    return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
  }

  // Check for org-defined layout (#+LAYOUT: #blockName)
  if (hasOrgLayout(parsed.metadata) || hasOrgWrapper(parsed.metadata)) {
    // Use org-defined layout/wrapper from the file itself
    const { html: orgHtml, hasLayout } = await renderWithOrgLayout(
      parsed.ast,
      parsed.metadata,
      async (ast) => {
        return renderOrgToHtml(ast, {
          base: config.base,
          metadata: parsed.metadata,
        });
      }
    );

    // If org file has its own layout, use it directly
    if (hasLayout) {
      const html = `<!DOCTYPE html>\n${orgHtml}`;
      return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
    }

    // Org file has wrapper but no layout - apply theme layout to wrapped content
    // Check if a specific theme layout is requested
    const themeLayoutName = getThemeLayoutName(parsed.metadata);
    const LayoutToUse = themeLayoutName ? getLayoutByName(themeLayoutName) : Layout;

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout: LayoutToUse,
      layoutProps: {
        // Pass pre-wrapped content
        content: orgHtml,
        currentPath: url,
      },
    });

    const html = `<!DOCTYPE html>\n${renderedHtml}`;
    return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
  }

  // Check for theme layout reference (#+LAYOUT: themeName without #)
  if (hasThemeLayout(parsed.metadata)) {
    const themeLayoutName = getThemeLayoutName(parsed.metadata)!;
    const LayoutToUse = getLayoutByName(themeLayoutName);

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout: LayoutToUse,
      layoutProps: {
        currentPath: url,
      },
    });

    const html = `<!DOCTYPE html>\n${renderedHtml}`;
    return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
  }

  // Render with default theme layout (no layout specified)
  const renderedHtml = await renderWithLayout({
    ast: parsed.ast,
    context: {
      base: config.base,
      metadata: parsed.metadata,
    },
    Layout,
    layoutProps: {
      currentPath: url,
    },
  });

  // Add DOCTYPE for full HTML documents
  const html = `<!DOCTYPE html>\n${renderedHtml}`;

  return { html, preloadLinks: "", collectedBlocks: parsed.collectedBlocks };
}
