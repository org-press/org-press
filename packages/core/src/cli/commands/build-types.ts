/**
 * Build Types Command
 *
 * Generates TypeScript declaration files for org code blocks.
 *
 * Usage:
 *   orgp build types [options]
 *
 * Options:
 *   --content-dir, -c <dir>   Content directory (default: "content")
 *   --out-dir, -o <dir>       Output directory (default: "dist/types")
 *   --quiet, -q               Suppress non-error output
 *   --help, -h                Show help
 *
 * Examples:
 *   orgp build types
 *   orgp build types --content-dir src/content --out-dir types
 *   orgp build types -c content -o dist/types
 */

import { DtsGenerator } from "../../dts/generator.ts";

/**
 * Options for build-types command
 */
export interface BuildTypesOptions {
  /** Content directory containing org files */
  contentDir?: string;
  /** Output directory for generated .d.ts files */
  outDir?: string;
  /** Suppress non-error output */
  quiet?: boolean;
}

/**
 * Parse command line arguments for build-types
 *
 * @param args - Command line arguments (after "build types")
 * @returns Parsed options
 */
export function parseBuildTypesArgs(args: string[]): BuildTypesOptions {
  const options: BuildTypesOptions = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--content-dir" || arg === "-c") {
      options.contentDir = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--content-dir=")) {
      options.contentDir = arg.slice("--content-dir=".length);
      i++;
      continue;
    }

    if (arg === "--out-dir" || arg === "-o") {
      options.outDir = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length);
      i++;
      continue;
    }

    if (arg === "--quiet" || arg === "-q") {
      options.quiet = true;
      i++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      showBuildTypesHelp();
      process.exit(0);
    }

    // Unknown argument
    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      console.error('Run "orgp build types --help" for usage');
      process.exit(1);
    }

    i++;
  }

  return options;
}

/**
 * Show help for build-types command
 */
export function showBuildTypesHelp(): void {
  console.log(`
orgp build types - Generate TypeScript declarations for org code blocks

USAGE:
  orgp build types [options]

OPTIONS:
  --content-dir, -c <dir>   Content directory containing org files
                            Default: "content"

  --out-dir, -o <dir>       Output directory for .d.ts files
                            Default: "dist/types"

  --quiet, -q               Suppress non-error output

  --help, -h                Show this help message

EXAMPLES:
  # Generate types with defaults
  orgp build types

  # Specify custom directories
  orgp build types --content-dir src/docs --out-dir types

  # Short form
  orgp build types -c content -o dist/types

OUTPUT:
  Creates .d.ts files for each TypeScript/JavaScript code block in org files.
  Also generates a block-manifest.json with block position information.
`);
}

/**
 * Execute build-types command
 *
 * @param options - Command options
 */
export async function buildTypes(options: BuildTypesOptions): Promise<void> {
  const contentDir = options.contentDir || "content";
  const outDir = options.outDir || "dist/types";

  if (!options.quiet) {
    console.log("[org-press] Generating type declarations...");
    console.log(`[org-press] Content: ${contentDir}/`);
    console.log(`[org-press] Output:  ${outDir}/`);
  }

  const startTime = Date.now();

  try {
    const generator = new DtsGenerator({
      contentDir,
      outDir,
      projectRoot: process.cwd(),
    });

    await generator.loadBlocks();
    await generator.writeDeclarations();

    const duration = Date.now() - startTime;

    if (!options.quiet) {
      console.log(`[org-press] Done in ${(duration / 1000).toFixed(2)}s`);
    }
  } catch (error) {
    console.error(
      "[org-press] Error generating types:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
