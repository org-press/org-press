/**
 * File-Based Routing
 *
 * Resolves org files in content directory to URL routes.
 * Follows Next.js-style conventions:
 * - index.org → /
 * - page.org → /page
 * - dir/index.org → /dir/
 * - dir/page.org → /dir/page
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * A single route entry
 */
export interface RouteEntry {
  /** URL path (e.g., "/guide/intro") */
  path: string;

  /** Path to org file relative to content dir */
  file: string;

  /** Absolute path to org file */
  absolutePath: string;

  /** Whether this is an index page */
  isIndex: boolean;

  /** Parent route path (e.g., "/guide" for "/guide/intro") */
  parent: string | null;

  /** Nested depth (0 for root) */
  depth: number;
}

/**
 * Options for route resolution
 */
export interface ResolveRoutesOptions {
  /** Include draft pages (status: draft) */
  includeDrafts?: boolean;

  /** File extensions to include (default: [".org"]) */
  extensions?: string[];

  /** Directories to ignore */
  ignoreDirs?: string[];

  /** Clean URLs (no .html extension) */
  cleanUrls?: boolean;
}

const DEFAULT_OPTIONS: Required<ResolveRoutesOptions> = {
  includeDrafts: false,
  extensions: [".org"],
  ignoreDirs: ["node_modules", ".git", ".org-press"],
  cleanUrls: true,
};

/**
 * Resolve routes from content directory
 *
 * Scans the content directory and returns an array of route entries.
 *
 * @param contentDir - Path to content directory
 * @param options - Resolution options
 * @returns Array of route entries
 *
 * @example
 * const routes = resolveRoutes("content");
 * // [
 * //   { path: "/", file: "index.org", ... },
 * //   { path: "/guide", file: "guide/index.org", ... },
 * //   { path: "/guide/intro", file: "guide/intro.org", ... },
 * // ]
 */
export function resolveRoutes(
  contentDir: string,
  options: ResolveRoutesOptions = {}
): RouteEntry[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const routes: RouteEntry[] = [];

  const absoluteContentDir = path.isAbsolute(contentDir)
    ? contentDir
    : path.resolve(process.cwd(), contentDir);

  if (!fs.existsSync(absoluteContentDir)) {
    return routes;
  }

  function scanDirectory(dir: string, relativePath: string = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (opts.ignoreDirs.includes(entry.name)) {
          continue;
        }
        scanDirectory(fullPath, relPath);
      } else {
        // Check extension
        const ext = path.extname(entry.name);
        if (!opts.extensions.includes(ext)) {
          continue;
        }

        const route = createRouteEntry(relPath, fullPath, absoluteContentDir, opts);
        routes.push(route);
      }
    }
  }

  scanDirectory(absoluteContentDir);

  // Sort routes by path for consistent output
  routes.sort((a, b) => a.path.localeCompare(b.path));

  return routes;
}

/**
 * Create a route entry from a file path
 */
function createRouteEntry(
  relativePath: string,
  absolutePath: string,
  contentDir: string,
  options: Required<ResolveRoutesOptions>
): RouteEntry {
  const basename = path.basename(relativePath, path.extname(relativePath));
  const dirname = path.dirname(relativePath);

  // Determine if this is an index file
  const isIndex = basename === "index";

  // Calculate URL path
  let urlPath: string;

  if (isIndex) {
    // index.org → directory path
    urlPath = dirname === "." ? "/" : `/${dirname}`;
  } else {
    // page.org → /page
    urlPath = dirname === "." ? `/${basename}` : `/${dirname}/${basename}`;
  }

  // Normalize path separators for Windows
  urlPath = urlPath.replace(/\\/g, "/");

  // Calculate depth based on path segments
  // / = depth 0
  // /about = depth 0 (root level pages)
  // /guide = depth 1 (directory index)
  // /guide/intro = depth 1 (pages in directory)
  // /guide/advanced/deep = depth 2
  const segments = urlPath.split("/").filter(Boolean);
  let depth: number;

  if (urlPath === "/") {
    depth = 0;
  } else if (isIndex) {
    // Index files: depth = number of segments
    depth = segments.length;
  } else {
    // Non-index files: depth = number of directory segments
    depth = segments.length - 1;
  }

  // Calculate parent path
  let parent: string | null = null;

  if (urlPath === "/") {
    // Root has no parent
    parent = null;
  } else if (isIndex) {
    // Index file's parent is the parent directory
    if (segments.length === 1) {
      parent = "/";
    } else {
      parent = "/" + segments.slice(0, -1).join("/");
    }
  } else {
    // Non-index file's parent is its directory
    if (segments.length === 1) {
      parent = "/";
    } else {
      parent = "/" + segments.slice(0, -1).join("/");
    }
  }

  return {
    path: urlPath,
    file: relativePath.replace(/\\/g, "/"),
    absolutePath,
    isIndex,
    parent,
    depth,
  };
}

/**
 * Convert route path to output file path
 *
 * @param routePath - URL path (e.g., "/guide/intro")
 * @param options - Options for output path generation
 * @returns Output file path (e.g., "guide/intro.html" or "guide/intro/index.html")
 */
export function routeToOutputPath(
  routePath: string,
  options: { cleanUrls?: boolean } = {}
): string {
  const cleanUrls = options.cleanUrls ?? true;

  if (routePath === "/") {
    return "index.html";
  }

  // Remove leading slash
  const pathWithoutSlash = routePath.slice(1);

  if (cleanUrls) {
    // /guide/intro → guide/intro/index.html
    return `${pathWithoutSlash}/index.html`;
  } else {
    // /guide/intro → guide/intro.html
    return `${pathWithoutSlash}.html`;
  }
}

/**
 * Find route by URL path
 *
 * @param routes - Array of route entries
 * @param urlPath - URL path to find
 * @returns Matching route or undefined
 */
export function findRoute(
  routes: RouteEntry[],
  urlPath: string
): RouteEntry | undefined {
  // Normalize path
  const normalized = urlPath === "/" ? "/" : urlPath.replace(/\/$/, "");

  return routes.find((r) => r.path === normalized);
}

/**
 * Get child routes for a given path
 *
 * @param routes - Array of route entries
 * @param parentPath - Parent path
 * @returns Array of child routes
 */
export function getChildRoutes(
  routes: RouteEntry[],
  parentPath: string
): RouteEntry[] {
  // Normalize parent path
  const normalized = parentPath === "/" ? "/" : parentPath.replace(/\/$/, "");

  return routes.filter((r) => r.parent === normalized);
}

/**
 * Get routes at a specific depth
 *
 * @param routes - Array of route entries
 * @param depth - Depth level (0 = root)
 * @returns Array of routes at that depth
 */
export function getRoutesAtDepth(
  routes: RouteEntry[],
  depth: number
): RouteEntry[] {
  return routes.filter((r) => r.depth === depth);
}

/**
 * Build route tree structure
 *
 * @param routes - Flat array of route entries
 * @returns Nested route tree
 */
export interface RouteTreeNode extends RouteEntry {
  children: RouteTreeNode[];
}

export function buildRouteTree(routes: RouteEntry[]): RouteTreeNode[] {
  const tree: RouteTreeNode[] = [];
  const routeMap = new Map<string, RouteTreeNode>();

  // Create tree nodes
  for (const route of routes) {
    routeMap.set(route.path, { ...route, children: [] });
  }

  // Build tree structure
  for (const route of routes) {
    const node = routeMap.get(route.path)!;

    if (route.parent === null) {
      tree.push(node);
    } else {
      const parentNode = routeMap.get(route.parent);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent doesn't exist, add to root
        tree.push(node);
      }
    }
  }

  return tree;
}
