/**
 * Layout System for Org-Press 2
 *
 * Handles loading and resolving layout components from theme directories.
 * Supports multiple conventions for defining layouts.
 */

import { join } from "node:path";
import type { LayoutComponent } from "../render/types.ts";

/**
 * Layout loading cache
 */
const layoutCache = new Map<string, LayoutComponent>();

/**
 * Load layout component from theme directory or file
 *
 * Supports multiple loading conventions:
 * 1. **File path** (e.g., ".org-press/themes/index.tsx"):
 *    - Default export (Layout component)
 *    - Named export `layouts` object
 *    - Named export `getLayout(name)` function
 * 2. **Directory path** (e.g., ".org-press/theme"):
 *    - .org-press/theme/Layout.tsx (default export)
 *    - .org-press/theme/layouts.tsx (named exports object)
 *    - .org-press/theme/index.tsx (getLayout function)
 * 3. **Fallback**: org-press default layout
 *
 * @param themePath - Path to theme file or directory
 * @param layoutName - Requested layout name (default: "default")
 * @returns Layout component
 *
 * @example
 * // File path
 * const Layout = await loadLayout(".org-press/themes/index.tsx");
 *
 * @example
 * // Directory path
 * const Layout = await loadLayout(".org-press/theme");
 *
 * @example
 * // Specific layout
 * const BlogLayout = await loadLayout(".org-press/theme", "blog");
 */
export async function loadLayout(
  themePath: string,
  layoutName: string = "default"
): Promise<LayoutComponent> {
  const cacheKey = `${themePath}:${layoutName}`;

  // Check cache
  if (layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey)!;
  }

  // Check if themePath is a file (ends with .tsx or .ts)
  const isFile = themePath.endsWith(".tsx") || themePath.endsWith(".ts");

  if (isFile) {
    // Load from file path directly
    return loadLayoutFromFile(themePath, layoutName, cacheKey);
  } else {
    // Load from directory using conventions
    return loadLayoutFromDirectory(themePath, layoutName, cacheKey);
  }
}

/**
 * Load layout from a specific file path
 *
 * @param filePath - Path to theme file (e.g., ".org-press/themes/index.tsx")
 * @param layoutName - Requested layout name
 * @param cacheKey - Cache key for this layout
 * @returns Layout component
 */
async function loadLayoutFromFile(
  filePath: string,
  layoutName: string,
  cacheKey: string
): Promise<LayoutComponent> {
  const absolutePath = join(process.cwd(), filePath);

  try {
    const themeModule = await import(absolutePath);

    // Try 1: getLayout function
    if (themeModule.getLayout && typeof themeModule.getLayout === "function") {
      const layout = themeModule.getLayout(layoutName) as LayoutComponent;
      if (layout) {
        layoutCache.set(cacheKey, layout);
        return layout;
      }
    }

    // Try 2: layouts object
    if (themeModule.layouts && themeModule.layouts[layoutName]) {
      const layout = themeModule.layouts[layoutName] as LayoutComponent;
      layoutCache.set(cacheKey, layout);
      return layout;
    }

    // Try 3: default export
    if (themeModule.default) {
      const layout = themeModule.default as LayoutComponent;
      layoutCache.set(cacheKey, layout);
      return layout;
    }

    // No valid export found
    console.warn(
      `[loadLayout] Theme file ${filePath} found but no valid layout export`
    );
  } catch (error) {
    console.warn(`[loadLayout] Failed to load theme from ${filePath}:`, error);
  }

  // Fallback to default layout
  return loadDefaultLayout();
}

/**
 * Load layout from a directory using conventions
 *
 * @param dirPath - Path to theme directory (e.g., ".org-press/theme")
 * @param layoutName - Requested layout name
 * @param cacheKey - Cache key for this layout
 * @returns Layout component
 */
async function loadLayoutFromDirectory(
  dirPath: string,
  layoutName: string,
  cacheKey: string
): Promise<LayoutComponent> {
  const basePath = join(process.cwd(), dirPath);

  // Try convention 1: Layout.tsx (default export)
  try {
    const layoutModule = await import(join(basePath, "Layout.tsx"));
    if (layoutModule.default) {
      const layout = layoutModule.default as LayoutComponent;
      layoutCache.set(cacheKey, layout);
      return layout;
    }
  } catch {
    // Not found, try next convention
  }

  // Try convention 2: layouts.tsx (named exports)
  try {
    const layoutsModule = await import(join(basePath, "layouts.tsx"));
    if (layoutsModule.layouts && layoutsModule.layouts[layoutName]) {
      const layout = layoutsModule.layouts[layoutName] as LayoutComponent;
      layoutCache.set(cacheKey, layout);
      return layout;
    }
  } catch {
    // Not found, try next convention
  }

  // Try convention 3: index.tsx (getLayout function)
  try {
    const indexModule = await import(join(basePath, "index.tsx"));
    if (indexModule.getLayout) {
      const layout = indexModule.getLayout(layoutName) as LayoutComponent;
      if (layout) {
        layoutCache.set(cacheKey, layout);
        return layout;
      }
    }
  } catch {
    // Not found, use fallback
  }

  // Fallback to default layout
  return loadDefaultLayout();
}

/**
 * Load default layout from org-press
 *
 * @returns Default layout component
 */
export async function loadDefaultLayout(): Promise<LayoutComponent> {
  const cacheKey = "org-press:default";

  if (layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey)!;
  }

  try {
    const defaultModule = await import("./default/Layout.tsx");
    const layout = defaultModule.default as LayoutComponent;
    layoutCache.set(cacheKey, layout);
    return layout;
  } catch (error) {
    throw new Error(
      `Failed to load default layout: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clear layout cache
 *
 * Useful during development when layouts change.
 */
export function clearLayoutCache(): void {
  layoutCache.clear();
}

/**
 * Preload layouts for faster access
 *
 * @param themePath - Path to theme directory
 * @param layoutNames - Array of layout names to preload
 */
export async function preloadLayouts(
  themePath: string,
  layoutNames: string[] = ["default"]
): Promise<void> {
  await Promise.all(
    layoutNames.map((name) => loadLayout(themePath, name))
  );
}
