/**
 * Org-Press 2 Build System
 *
 * Handles static site generation for org-press sites.
 * Full implementation ported from org-press with clean architecture.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";
import pMap from "p-map";
import type { OrgPressConfig, ThemeConfig } from "../../config/types.ts";
import { getContentPages } from "../../content.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
 * Build options
 */
export interface BuildOptions {
  /** Org-press configuration */
  config: OrgPressConfig;

  /** Vite config path (optional) */
  viteConfigPath?: string;

  /** Enable SSR (default: true) */
  ssr?: boolean;

  /** Parallel rendering (default: true) */
  parallel?: boolean;
}

/**
 * Build result
 */
export interface BuildResult {
  /** Number of pages rendered */
  pageCount: number;

  /** Build duration in milliseconds */
  duration: number;

  /** Output directory */
  outDir: string;
}

/**
 * Asset manifest for production
 */
interface AssetManifest {
  css: string[];
  js: string | null;
  /** Path to hydration script */
  hydrate: string | null;
  /** Full Vite manifest for block hydration */
  viteManifest: ViteManifest;
}

/**
 * Vite manifest structure
 */
interface ViteManifest {
  [key: string]: {
    file: string;
    src?: string;
    css?: string[];
    assets?: string[];
    imports?: string[];
  };
}

/**
 * Build org-press site
 *
 * Process:
 * 1. Build client assets (Vite build)
 * 2. Build SSR bundle (Vite build --ssr)
 * 3. Pre-render pages (parallel)
 * 4. Copy cache files to dist
 * 5. Generate asset manifest
 *
 * @param options - Build options
 * @returns Build result
 */
export async function build(options: BuildOptions): Promise<BuildResult> {
  const startTime = Date.now();
  const { config } = options;

  const outDir = config.outDir || "dist";
  const contentDir = config.contentDir || "content";

  console.log("[org-press:build] Starting build process...");
  console.log(`[org-press:build] Content: ${contentDir}/`);
  console.log(`[org-press:build] Output:  ${outDir}/`);
  console.log(`[org-press:build] Concurrency: ${config.buildConcurrency} workers`);

  try {
    const absoluteOutDir = path.resolve(process.cwd(), outDir);

    // Step 1: Build client assets
    console.log("[org-press:build] Building client assets...");
    const assetManifest = await buildClientAssets(absoluteOutDir, config);

    // Step 2: Build SSR bundle
    console.log("[org-press:build] Building SSR bundle...");
    await buildSSRBundle(config);

    // Step 3: Get all routes and pre-render pages
    console.log("[org-press:build] Pre-rendering pages...");
    const pages = await getContentPages({
      includeDrafts: false,
      contentDir: config.contentDir,
    });

    const { successful, failed } = await prerenderPages(
      config,
      pages,
      assetManifest
    );

    // Step 4: Copy cache directory to dist
    console.log("[org-press:build] Copying cache directory...");
    await copyCacheToDist(config);

    // Step 5: Cleanup
    console.log("[org-press:build] Cleaning up...");
    await cleanup(config);

    // Summary
    const duration = Date.now() - startTime;
    console.log(`\n[org-press:build] Build complete in ${(duration / 1000).toFixed(2)}s!`);
    console.log(`[org-press:build] ✓ ${successful} pages rendered successfully`);
    if (failed > 0) {
      console.log(`[org-press:build] ✗ ${failed} pages failed`);
    }

    return {
      pageCount: successful,
      duration,
      outDir: absoluteOutDir,
    };
  } catch (error) {
    console.error("[org-press:build] Build failed:", error);
    throw error;
  }
}

/**
 * Get all script files in cache directory (JS, TS, TSX, JSX)
 */
function getCacheScriptFiles(config: OrgPressConfig): Record<string, string> {
  const cacheDir = path.resolve(config.cacheDir);
  const scriptFiles: Record<string, string> = {};

  // Extensions to include as build inputs
  const scriptExtensions = [".js", ".ts", ".tsx", ".jsx"];

  if (!fs.existsSync(cacheDir)) {
    return scriptFiles;
  }

  function findScriptFiles(dir: string, relativePath = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Skip build output directories
        if (
          relativePath === "" &&
          (entry.name === "server" || entry.name === "client")
        ) {
          continue;
        }
        findScriptFiles(fullPath, relPath);
      } else if (scriptExtensions.some(ext => entry.name.endsWith(ext))) {
        scriptFiles[relPath] = fullPath;
      }
    }
  }

  findScriptFiles(cacheDir);
  return scriptFiles;
}

/**
 * Get theme entry point if it exists
 */
function getThemeEntryPoint(config: OrgPressConfig): Record<string, string> {
  const themeEntries: Record<string, string> = {};
  const themePathStr = resolveThemePath(config.theme);
  const themePath = path.isAbsolute(themePathStr)
    ? themePathStr
    : path.resolve(process.cwd(), themePathStr);

  if (fs.existsSync(themePath)) {
    themeEntries["theme"] = themePath;
  }

  return themeEntries;
}

/**
 * Build client assets using Vite
 */
async function buildClientAssets(
  outDir: string,
  config: OrgPressConfig
): Promise<AssetManifest> {
  const cacheScriptFiles = getCacheScriptFiles(config);
  const themeFiles = getThemeEntryPoint(config);

  // Entry client path - use ./client/ since tsup flattens output to dist/
  const entryClientPath = path.resolve(
    __dirname,
    "./client/entry-client.tsx"
  );

  // Hydration script path (input for bundling)
  const hydrateInputPath = path.resolve(__dirname, "./client/hydrate.ts");

  const input: Record<string, string> = {
    "entry-client": entryClientPath,
    hydrate: hydrateInputPath,
  };

  // Add cache files
  for (const [entryName, filePath] of Object.entries(cacheScriptFiles)) {
    input[entryName] = filePath;
  }

  // Add theme file
  for (const [entryName, filePath] of Object.entries(themeFiles)) {
    input[entryName] = filePath;
  }

  if (Object.keys(cacheScriptFiles).length > 0) {
    console.log(
      `[org-press:build] Including ${Object.keys(cacheScriptFiles).length} cache files`
    );
  }

  // Build to cache directory first
  const clientBuildDir = path.join(config.cacheDir, "client");

  // Dynamically import orgPress to avoid circular dependencies
  const { orgPress } = await import("../vite-plugin-org-press.ts");

  await viteBuild({
    plugins: await orgPress(config),
    build: {
      outDir: clientBuildDir,
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input,
        preserveEntrySignatures: "exports-only",
        external: (id) => {
          return (
            id.includes(".org?") ||
            id.endsWith(".org") ||
            id.includes(".node") ||
            id === "fsevents" ||
            id.startsWith("fsevents/")
          );
        },
        output: {
          format: "es",
          entryFileNames: (chunkInfo) => {
            // entry-client and hydrate go to assets with hash
            if (chunkInfo.name === "entry-client" || chunkInfo.name === "hydrate") {
              return "assets/[name]-[hash].js";
            }
            // Cache files (block modules) go to cache directory
            if (chunkInfo.name) {
              const cacheDir = path.relative(process.cwd(), config.cacheDir);
              const normalizedCacheDir = cacheDir.replace(/\\/g, "/");
              return `${normalizedCacheDir}/${chunkInfo.name}`;
            }
            return "assets/[name]-[hash].js";
          },
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    resolve: {
      alias: {
        "#root": process.cwd(),
        "#cache": path.resolve(process.cwd(), config.cacheDir),
        ...config.vite?.resolve?.alias,
      },
    },
    logLevel: "warn",
    ...config.vite,
  });

  // Copy to final outDir
  console.log(
    `[org-press:build] Copying client assets to ${outDir}`
  );
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  copyDirectoryRecursive(clientBuildDir, outDir);

  // Read manifest for asset paths
  const manifestPath = path.join(clientBuildDir, ".vite/manifest.json");
  const viteManifest: ViteManifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  );

  const cssPaths: string[] = [];
  let jsPath: string | null = null;

  // Get entry-client paths - look for the entry by name in manifest
  // The manifest key is the absolute path, so we search for entry-client in values
  let entryClient: ViteManifest[string] | undefined;
  for (const [key, value] of Object.entries(viteManifest)) {
    if (key.includes("entry-client") || value.src?.includes("entry-client")) {
      entryClient = value;
      break;
    }
  }
  if (entryClient) {
    jsPath = entryClient.file ? `/${entryClient.file}` : null;
    if (entryClient.css && entryClient.css.length > 0) {
      cssPaths.push(...entryClient.css.map((css) => `/${css}`));
    }
  }

  // Get theme CSS
  const themeRelPath = path
    .relative(process.cwd(), resolveThemePath(config.theme))
    .replace(/\\/g, "/");
  const themeEntry = viteManifest[themeRelPath];
  if (themeEntry && themeEntry.file && themeEntry.file.endsWith(".css")) {
    cssPaths.push(`/${themeEntry.file}`);
  }

  // Get hydration script path
  let hydratePath: string | null = null;
  for (const [key, value] of Object.entries(viteManifest)) {
    if (key.includes("hydrate") || value.src?.includes("hydrate")) {
      hydratePath = value.file ? `/${value.file}` : null;
      break;
    }
  }

  return {
    css: cssPaths,
    js: jsPath,
    hydrate: hydratePath,
    viteManifest,
  };
}

/**
 * Build SSR bundle
 */
async function buildSSRBundle(config: OrgPressConfig): Promise<void> {
  const ssrOutDir = path.join(config.cacheDir, "server");
  const themePathStr = resolveThemePath(config.theme);
  const userThemePath = path.isAbsolute(themePathStr)
    ? themePathStr
    : path.resolve(process.cwd(), themePathStr);

  // Check if user theme exists, otherwise use default layout
  let themePath: string;
  if (fs.existsSync(userThemePath)) {
    themePath = userThemePath;
  } else {
    // Fallback to built-in default layout
    // Use createRequire to resolve package path in ESM context
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    try {
      // Try to resolve from the org-press package
      const orgPressPath = path.dirname(require.resolve("org-press/package.json"));
      themePath = path.join(orgPressPath, "dist/layouts/default/Layout.tsx");
    } catch {
      // Fallback to relative path if require.resolve fails
      // __dirname is dist/ when bundled, layouts is at dist/layouts/
      themePath = path.join(__dirname, "layouts/default/Layout.tsx");
    }
    console.log("[org-press:build] No custom theme found, using default layout");
  }

  const { orgPress } = await import("../vite-plugin-org-press.ts");

  // Entry generate path - use ./node/ since tsup copies it to dist/node/
  const entryGeneratePath = path.resolve(__dirname, "./node/entry-generate.tsx");

  await viteBuild({
    plugins: await orgPress(config),
    build: {
      ssr: entryGeneratePath,
      outDir: ssrOutDir,
      rollupOptions: {
        external: (id) => {
          return (
            id.includes(".node") ||
            id === "fsevents" ||
            id.startsWith("fsevents/")
          );
        },
      },
    },
    resolve: {
      alias: {
        "#root": process.cwd(),
        "#theme": themePath,
        "#cache": path.resolve(process.cwd(), config.cacheDir),
        ...config.vite?.resolve?.alias,
      },
    },
    logLevel: "warn",
    ...config.vite,
  });
}

/**
 * Content page info from getContentPages
 */
interface ContentPage {
  file: string;
  url: string;
  metadata: Record<string, any>;
}

/**
 * Pre-render all pages to static HTML
 */
async function prerenderPages(
  config: OrgPressConfig,
  pages: ContentPage[],
  assetManifest: AssetManifest
): Promise<{ successful: number; failed: number }> {
  const serverEntryPath = path.resolve(
    config.cacheDir,
    "server/entry-generate.js"
  );

  if (!fs.existsSync(serverEntryPath)) {
    throw new Error(
      `Server entry not found at ${serverEntryPath}. Run server build first.`
    );
  }

  const serverModule = await import(serverEntryPath);
  const { render } = serverModule;

  let successful = 0;
  let failed = 0;
  let rendered = 0;

  const clientBuildDir = path.join(config.cacheDir, "client");

  await pMap(
    pages,
    async (page) => {
      const routeUrl = page.url;
      try {
        const { html, collectedBlocks } = await render(routeUrl, {});

        if (!html) {
          console.warn(`[org-press:build] Skipped (no content): ${routeUrl}`);
          failed++;
          return;
        }

        // Remove theme entry script tags (dev mode only)
        let htmlWithAssets = html.replace(
          /<script[^>]*\ssrc="[^"]*\.org-press\/themes\/[^"]+\.tsx?"[^>]*>\s*<\/script>/g,
          ""
        );

        // Inject CSS and JS
        const assetLinks: string[] = [];
        for (const cssPath of assetManifest.css) {
          assetLinks.push(`<link rel="stylesheet" href="${cssPath}"/>`);
        }
        if (assetManifest.js) {
          assetLinks.push(
            `<script type="module" src="${assetManifest.js}"></script>`
          );
        }

        if (assetLinks.length > 0) {
          htmlWithAssets = htmlWithAssets.replace(
            "</head>",
            `${assetLinks.join("")}</head>`
          );
        }

        // Inject block hydration manifest and script if page has interactive blocks
        htmlWithAssets = injectHydration(
          htmlWithAssets,
          assetManifest,
          config,
          collectedBlocks || []
        );

        // Apply base path
        let processedHtml = applyBasePath(htmlWithAssets, config.base);

        // Determine output path
        // index.org files -> dir/index.html (e.g., guide/index.org -> guide/index.html)
        // other files -> path.html (e.g., guide/getting-started.org -> guide/getting-started.html)
        let filePath: string;
        const isIndexFile = page.file.endsWith("index.org");
        if (routeUrl === "/") {
          filePath = `${config.outDir}/index.html`;
        } else if (isIndexFile) {
          // index.org -> dir/index.html
          filePath = `${config.outDir}${routeUrl}/index.html`;
        } else {
          filePath = `${config.outDir}${routeUrl}.html`;
        }

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, processedHtml);

        successful++;
        rendered++;

        if (rendered % 10 === 0 || rendered === pages.length) {
          console.log(
            `[org-press:build] Progress: ${rendered}/${pages.length} pages`
          );
        }
      } catch (error) {
        console.error(`[org-press:build] Failed to render ${routeUrl}:`, error);
        failed++;
      }
    },
    { concurrency: config.buildConcurrency }
  );

  return { successful, failed };
}

/**
 * Apply base path to all URLs
 */
export function applyBasePath(html: string, base: string): string {
  if (!base || base === "/") {
    return html;
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  let result = html;

  // Replace asset paths
  result = result.replace(
    /(href|src)="(\/assets\/[^"]*)"/g,
    `$1="${normalizedBase}$2"`
  );

  // Replace HTML links (skip if base already applied)
  result = result.replace(/href="(\/[^"]*\.html)"/g, (match, url) => {
    if (url.startsWith(normalizedBase)) {
      return match;
    }
    return `href="${normalizedBase}${url}"`;
  });

  // Replace internal links
  result = result.replace(/href="(\/[^":][^"]*)"/g, (match, url) => {
    if (url.startsWith(normalizedBase) || url.match(/^(https?:)?\/\//)) {
      return match;
    }
    return `href="${normalizedBase}${url}"`;
  });

  // Replace cache directory paths
  result = result.replace(
    /(href|src)="(\/node_modules\/\.org-press[^"]*)"/g,
    `$1="${normalizedBase}$2"`
  );

  // Replace dynamic imports
  result = result.replace(
    /import\('(\/node_modules\/\.org-press-cache[^']*)'\)/g,
    `import('${normalizedBase}$1')`
  );

  return result;
}

/**
 * Collected block info from the parser
 */
export interface CollectedBlock {
  id: string;
  containerId: string;
  cachePath: string;
  name?: string;
  language: string;
}

/**
 * Build block manifest from collected blocks
 *
 * Maps block IDs to their bundled module paths by looking up each block's
 * cache path in the Vite manifest.
 *
 * @param collectedBlocks - Blocks collected during parsing
 * @param viteManifest - Vite build manifest mapping source to output paths
 * @param base - Base path for URLs (default: "/")
 * @returns Manifest mapping block IDs to { src } objects
 */
export function buildBlockManifest(
  collectedBlocks: CollectedBlock[],
  viteManifest: ViteManifest,
  base: string = "/"
): Record<string, { src: string }> {
  const manifest: Record<string, { src: string }> = {};
  const normalizedBase = base.replace(/\/$/, "");

  for (const block of collectedBlocks) {
    // Get relative cache path for matching against viteManifest
    const relativeCachePath = path
      .relative(process.cwd(), block.cachePath)
      .replace(/\\/g, "/");

    // Try to find the bundled output in viteManifest
    let outputPath: string | undefined;

    // Direct match
    const entry = viteManifest[relativeCachePath];
    if (entry?.file) {
      outputPath = entry.file;
    }

    // Try without leading ./ if present
    if (!outputPath) {
      const cleanPath = relativeCachePath.replace(/^\.\//, "");
      const cleanEntry = viteManifest[cleanPath];
      if (cleanEntry?.file) {
        outputPath = cleanEntry.file;
      }
    }

    // Try searching by filename as fallback
    if (!outputPath) {
      const filename = path.basename(block.cachePath);
      for (const [key, value] of Object.entries(viteManifest)) {
        if (key.endsWith(filename) && value.file) {
          outputPath = value.file;
          break;
        }
      }
    }

    if (outputPath) {
      manifest[block.id] = {
        src: `${normalizedBase}/${outputPath}`,
      };
    }
  }

  return manifest;
}

/**
 * Inject block hydration manifest and script into HTML
 *
 * Uses the collected blocks from parsing to build a manifest mapping
 * block IDs to their bundled module paths.
 *
 * @param html - The rendered HTML
 * @param assetManifest - Vite build manifest with bundled assets
 * @param config - Org-press config
 * @param collectedBlocks - Blocks collected during parsing
 */
function injectHydration(
  html: string,
  assetManifest: AssetManifest,
  config: OrgPressConfig,
  collectedBlocks: CollectedBlock[]
): string {
  // No blocks or no hydrate script, nothing to do
  if (collectedBlocks.length === 0 || !assetManifest.hydrate) {
    return html;
  }

  // Build manifest for this page's blocks
  const pageManifest = buildBlockManifest(
    collectedBlocks,
    assetManifest.viteManifest,
    config.base
  );

  // Warn about any blocks that couldn't be matched
  for (const block of collectedBlocks) {
    if (!pageManifest[block.id]) {
      const relativeCachePath = path
        .relative(process.cwd(), block.cachePath)
        .replace(/\\/g, "/");
      console.warn(
        `[org-press:build] Could not find bundled output for block: ${block.id} (${relativeCachePath})`
      );
    }
  }

  // Generate manifest script
  const manifestScript =
    Object.keys(pageManifest).length > 0
      ? `<script>window.__ORG_PRESS_MANIFEST__=${JSON.stringify(pageManifest)};</script>`
      : "";

  // Generate hydrate script tag
  const hydrateScript = `<script type="module" src="${assetManifest.hydrate}"></script>`;

  // Inject before </body>
  if (html.includes("</body>")) {
    return html.replace(
      "</body>",
      `${manifestScript}${hydrateScript}</body>`
    );
  }

  // Fallback: append at end
  return html + manifestScript + hydrateScript;
}

/**
 * Copy cache directory to dist
 */
async function copyCacheToDist(config: OrgPressConfig): Promise<void> {
  const cacheDir = path.resolve(config.cacheDir);
  const distCacheDir = path.resolve(
    config.outDir,
    config.cacheDir.replace(process.cwd() + path.sep, "")
  );

  if (fs.existsSync(cacheDir)) {
    fs.mkdirSync(distCacheDir, { recursive: true });
    copyDirectoryRecursive(cacheDir, distCacheDir, { skipBuildDirs: true });
    console.log(`[org-press:build] Copied ${cacheDir} to ${distCacheDir}`);
  }
}

/**
 * Recursively copy directory
 */
function copyDirectoryRecursive(
  src: string,
  dest: string,
  options: { skipJs?: boolean; skipBuildDirs?: boolean } = {}
): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (
        options.skipBuildDirs &&
        (entry.name === "client" || entry.name === "server")
      ) {
        continue;
      }
      copyDirectoryRecursive(srcPath, destPath, options);
    } else {
      if (options.skipJs && entry.name.endsWith(".js")) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Cleanup after build
 */
async function cleanup(config: OrgPressConfig): Promise<void> {
  const viteDir = path.resolve(config.outDir, ".vite");
  if (fs.existsSync(viteDir)) {
    fs.rmSync(viteDir, { recursive: true });
  }
}

/**
 * Discover all .org files in content directory
 */
export function discoverPages(contentDir: string): string[] {
  const pages: string[] = [];

  function findOrgFiles(dir: string, relativePath = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        findOrgFiles(fullPath, relPath);
      } else if (entry.name.endsWith(".org")) {
        pages.push(relPath);
      }
    }
  }

  if (fs.existsSync(contentDir)) {
    findOrgFiles(contentDir);
  }

  return pages;
}

/**
 * Convert .org path to .html path
 */
export function orgPathToHtmlPath(orgPath: string): string {
  return orgPath.replace(/\.org$/, ".html");
}

/**
 * Render single page (used for testing)
 */
export async function renderPage(
  orgPath: string,
  config: OrgPressConfig
): Promise<string> {
  // This would use the SSR bundle to render a single page
  // Implementation would be similar to prerenderPages but for one page
  throw new Error("renderPage not implemented yet");
}
