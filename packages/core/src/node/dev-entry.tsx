/**
 * Org-Press 2 Dev Server Entry Point
 *
 * Loaded via Vite's SSR module loader in dev mode.
 * Provides a render function for on-the-fly page rendering.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { OrgPressConfig, ThemeConfig } from "../config/types.ts";
import { parseOrgContent } from "../parser/parse-content.ts";
import { renderWithLayout } from "../render/render-static.tsx";
import { loadLayout } from "../layouts/index.ts";
import { contentHelpers } from "../content.ts";
import type { BlockPlugin } from "../plugins/types.ts";
import {
  hasOrgLayout,
  hasOrgWrapper,
  hasThemeLayout,
  getThemeLayoutName,
  renderWithOrgLayout,
  hasCrossFileLayout,
  hasCrossFileWrapper,
  renderWithOrgLayoutAsync,
} from "../render/org-layout.ts";
import { renderOrgToHtml } from "../render/render.ts";
import { resolve } from "node:path";

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
 * Compute URL path from org file path
 * e.g., "content/plugins/excalidraw.org" -> "/plugins/excalidraw.html"
 */
function orgPathToUrl(orgPath: string, contentDir: string): string {
  // Remove contentDir prefix
  let relativePath = orgPath;
  if (orgPath.startsWith(contentDir + "/")) {
    relativePath = orgPath.slice(contentDir.length + 1);
  } else if (orgPath.startsWith(contentDir)) {
    relativePath = orgPath.slice(contentDir.length);
  }

  // Change extension from .org to .html
  const htmlPath = relativePath.replace(/\.org$/, ".html");

  // Ensure leading slash
  return htmlPath.startsWith("/") ? htmlPath : "/" + htmlPath;
}

/**
 * Render options for dev mode
 */
export interface DevRenderOptions {
  /** Org-press configuration */
  config: OrgPressConfig;

  /** Loaded block plugins */
  plugins: BlockPlugin[];

  /** Path to .org file */
  orgPath: string;
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
}

/**
 * Render result for dev mode
 */
export interface DevRenderResult {
  html: string;
  collectedBlocks: CollectedBlockInfo[];
}

/**
 * Render .org file to HTML (dev mode)
 *
 * @param options - Render options
 * @returns Rendered HTML and collected blocks
 */
export async function renderOrgFile(
  options: DevRenderOptions
): Promise<DevRenderResult> {
  const { config, plugins, orgPath } = options;

  // 1. Read .org file
  if (!existsSync(orgPath)) {
    throw new Error(`File not found: ${orgPath}`);
  }

  const orgContent = await readFile(orgPath, "utf-8");

  // 2. Get relative path from PROJECT ROOT (not content dir)
  // Virtual blocks plugin expects paths relative to project root
  const relativeOrgPath = relative(process.cwd(), orgPath);

  // 3. Parse org content
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
  const parsed = await parseOrgContent(
    orgContent,
    parseContext,
    contentHelpers
  );

  // Compute URL path for navigation highlighting
  const currentPath = orgPathToUrl(orgPath, config.contentDir);

  // 4. Check for cross-file layout/wrapper (#+LAYOUT: ./path.org#block)
  if (hasCrossFileLayout(parsed.metadata) || hasCrossFileWrapper(parsed.metadata)) {
    const absoluteOrgPath = resolve(process.cwd(), orgPath);
    const contentDirAbsolute = resolve(process.cwd(), config.contentDir);

    const { html, hasLayout } = await renderWithOrgLayoutAsync(
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
        devMode: true,
      }
    );

    // If cross-file layout was found, use it directly
    if (hasLayout) {
      return { html, collectedBlocks: parsed.collectedBlocks };
    }

    // Cross-file wrapper but no layout - apply theme layout to wrapped content
    const themeLayoutName = getThemeLayoutName(parsed.metadata);
    const Layout = themeLayoutName
      ? await loadLayout(resolveThemePath(config.theme), themeLayoutName)
      : await loadLayout(resolveThemePath(config.theme));

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout,
      layoutProps: {
        content: html,
        currentPath,
      },
    });

    return { html: renderedHtml, collectedBlocks: parsed.collectedBlocks };
  }

  // 5. Check for org-defined layout (#+LAYOUT: #blockName)
  if (hasOrgLayout(parsed.metadata) || hasOrgWrapper(parsed.metadata)) {
    // Use org-defined layout/wrapper from the file itself
    const { html, hasLayout } = await renderWithOrgLayout(
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
      return { html, collectedBlocks: parsed.collectedBlocks };
    }

    // Org file has wrapper but no layout - apply theme layout to wrapped content
    // Check if a specific theme layout is requested
    const themeLayoutName = getThemeLayoutName(parsed.metadata);
    const Layout = themeLayoutName
      ? await loadLayout(resolveThemePath(config.theme), themeLayoutName)
      : await loadLayout(resolveThemePath(config.theme));

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout,
      layoutProps: {
        // Pass pre-wrapped content
        content: html,
        currentPath,
      },
    });

    return { html: renderedHtml, collectedBlocks: parsed.collectedBlocks };
  }

  // 6. Check for theme layout reference (#+LAYOUT: themeName without #)
  if (hasThemeLayout(parsed.metadata)) {
    const themeLayoutName = getThemeLayoutName(parsed.metadata)!;
    const Layout = await loadLayout(resolveThemePath(config.theme), themeLayoutName);

    const renderedHtml = await renderWithLayout({
      ast: parsed.ast,
      context: {
        base: config.base,
        metadata: parsed.metadata,
      },
      Layout,
      layoutProps: {
        currentPath,
      },
    });

    return { html: renderedHtml, collectedBlocks: parsed.collectedBlocks };
  }

  // 7. Load default theme layout (no layout specified)
  const Layout = await loadLayout(resolveThemePath(config.theme));

  // 8. Render with theme layout
  const renderedHtml = await renderWithLayout({
    ast: parsed.ast,
    context: {
      base: config.base,
      metadata: parsed.metadata,
    },
    Layout,
    layoutProps: {
      currentPath,
    },
  });

  return { html: renderedHtml, collectedBlocks: parsed.collectedBlocks };
}
