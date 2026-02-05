/**
 * Build Output Structure
 *
 * Handles output path generation for different build modes:
 * - Single file mode: One org file → one output file
 * - Directory mode: Directory of org files → mirror structure
 * - Clean URLs: /page → page/index.html
 * - Flat URLs: /page → page.html
 */

import * as path from "node:path";
import * as fs from "node:fs";
import type { RouteEntry } from "../../routing/index.ts";
import { resolveRoutes, routeToOutputPath } from "../../routing/index.ts";

/**
 * Output mode options
 */
export interface OutputOptions {
  /** Use clean URLs (page/index.html instead of page.html) */
  cleanUrls?: boolean;

  /** Base output directory */
  outDir: string;

  /** Content directory (for relative path calculation) */
  contentDir: string;
}

/**
 * Output entry for a single page
 */
export interface OutputEntry {
  /** Source org file path (absolute) */
  sourcePath: string;

  /** Output HTML file path (absolute) */
  outputPath: string;

  /** URL path for the page */
  urlPath: string;

  /** Whether this is an index page */
  isIndex: boolean;
}

/**
 * Result of resolving build outputs
 */
export interface BuildOutputs {
  /** All output entries */
  entries: OutputEntry[];

  /** Total number of pages */
  pageCount: number;

  /** Output directory (absolute) */
  outDir: string;
}

const DEFAULT_OPTIONS: Partial<OutputOptions> = {
  cleanUrls: true,
};

/**
 * Resolve build outputs from content directory
 *
 * Scans the content directory and determines output paths for all org files.
 *
 * @param options - Output options
 * @returns Build outputs with all entries
 */
export function resolveBuildOutputs(options: OutputOptions): BuildOutputs {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const absoluteOutDir = path.isAbsolute(opts.outDir)
    ? opts.outDir
    : path.resolve(process.cwd(), opts.outDir);

  const routes = resolveRoutes(opts.contentDir);

  const entries: OutputEntry[] = routes.map((route) =>
    createOutputEntry(route, absoluteOutDir, opts.cleanUrls!)
  );

  return {
    entries,
    pageCount: entries.length,
    outDir: absoluteOutDir,
  };
}

/**
 * Create output entry from route
 */
function createOutputEntry(
  route: RouteEntry,
  outDir: string,
  cleanUrls: boolean
): OutputEntry {
  const outputRelativePath = routeToOutputPath(route.path, { cleanUrls });
  const outputPath = path.join(outDir, outputRelativePath);

  return {
    sourcePath: route.absolutePath,
    outputPath,
    urlPath: route.path,
    isIndex: route.isIndex,
  };
}

/**
 * Get output path for a single org file
 *
 * Used for single-file build mode.
 *
 * @param orgFile - Path to org file
 * @param outDir - Output directory
 * @param options - Output options
 * @returns Absolute output path
 */
export function getSingleFileOutput(
  orgFile: string,
  outDir: string,
  options: { cleanUrls?: boolean } = {}
): string {
  const cleanUrls = options.cleanUrls ?? false; // Default to flat for single file
  const absoluteOutDir = path.isAbsolute(outDir)
    ? outDir
    : path.resolve(process.cwd(), outDir);

  // For single file, always output as index.html
  return path.join(absoluteOutDir, "index.html");
}

/**
 * Ensure output directory exists
 *
 * Creates the directory and any parent directories.
 *
 * @param outputPath - Path to output file
 */
export function ensureOutputDir(outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write HTML output file
 *
 * @param outputPath - Absolute path to output file
 * @param html - HTML content
 */
export function writeOutput(outputPath: string, html: string): void {
  ensureOutputDir(outputPath);
  fs.writeFileSync(outputPath, html, "utf-8");
}

/**
 * Clean output directory
 *
 * Removes all files in the output directory.
 *
 * @param outDir - Output directory to clean
 */
export function cleanOutputDir(outDir: string): void {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
}

/**
 * Get relative output path from output directory
 *
 * @param outputPath - Absolute output path
 * @param outDir - Output directory
 * @returns Relative path
 */
export function getRelativeOutputPath(
  outputPath: string,
  outDir: string
): string {
  return path.relative(outDir, outputPath);
}

/**
 * Map org file path to output path
 *
 * Simple conversion for legacy compatibility.
 * Prefer using resolveBuildOutputs for new code.
 *
 * @param orgPath - Relative org file path
 * @param outDir - Output directory
 * @param options - Output options
 * @returns Absolute output path
 */
export function orgToOutputPath(
  orgPath: string,
  outDir: string,
  options: { cleanUrls?: boolean } = {}
): string {
  const cleanUrls = options.cleanUrls ?? true;
  const basename = path.basename(orgPath, ".org");
  const dirname = path.dirname(orgPath);

  let outputRelative: string;

  if (basename === "index") {
    // index.org → index.html or dir/index.html
    outputRelative =
      dirname === "." ? "index.html" : path.join(dirname, "index.html");
  } else if (cleanUrls) {
    // page.org → page/index.html
    outputRelative =
      dirname === "."
        ? path.join(basename, "index.html")
        : path.join(dirname, basename, "index.html");
  } else {
    // page.org → page.html
    outputRelative =
      dirname === "."
        ? `${basename}.html`
        : path.join(dirname, `${basename}.html`);
  }

  return path.join(outDir, outputRelative);
}
