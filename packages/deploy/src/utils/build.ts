/**
 * Build utilities for deploy
 *
 * Handles the build phase of deployment: transpilation, output generation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { OrgData } from "uniorg";
import type { PackageMetadata, NamedBlock, DeployLogger } from "../types.ts";
import { generatePackageJson } from "./manifest.ts";
import { generateReadme } from "./readme.ts";

/**
 * Build options
 */
export interface BuildOptions {
  /** Skip README generation */
  noReadme?: boolean;
  /** Logger for output */
  logger?: DeployLogger;
}

/**
 * Build result
 */
export interface BuildResult {
  /** Output directory */
  outDir: string;
  /** List of generated files */
  files: string[];
}

/**
 * Build package from named blocks
 *
 * Creates the output directory with:
 * - dist/index.js (from main block)
 * - dist/{name}.js (from other named blocks)
 * - package.json
 * - README.md (optional)
 *
 * @param outDir - Output directory
 * @param ast - Parsed org AST (for README generation)
 * @param metadata - Package metadata
 * @param namedBlocks - Named code blocks to transpile
 * @param options - Build options
 * @returns Build result with output directory and file list
 */
export async function buildPackage(
  outDir: string,
  ast: OrgData,
  metadata: PackageMetadata,
  namedBlocks: NamedBlock[],
  options: BuildOptions = {}
): Promise<BuildResult> {
  const logger = options.logger || createDefaultLogger();
  const files: string[] = [];

  // Clean and create output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Create dist directory
  const distDir = path.join(outDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });

  // Transpile named blocks
  for (const block of namedBlocks) {
    // main -> index.js, types -> types.js, etc.
    const outputFile = block.name === "main" ? "index.js" : `${block.name}.js`;
    const outputPath = path.join(distDir, outputFile);

    // Transpile TypeScript to JavaScript
    const code = transpileCode(block.code, block.language);
    fs.writeFileSync(outputPath, code);
    files.push(`dist/${outputFile}`);

    logger.info(`Generated dist/${outputFile}`);
  }

  // Generate package.json
  const packageJson = generatePackageJson(metadata, namedBlocks);
  fs.writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  files.push("package.json");
  logger.info("Generated package.json");

  // Generate README.md
  if (!options.noReadme) {
    const readme = generateReadme(ast, metadata);
    fs.writeFileSync(path.join(outDir, "README.md"), readme);
    files.push("README.md");
    logger.info("Generated README.md");
  }

  return { outDir, files };
}

/**
 * Simple TypeScript to JavaScript transpilation
 *
 * Strips TypeScript type annotations for basic transpilation.
 * For production use, consider using esbuild or tsc.
 *
 * @param code - Source code
 * @param language - Source language
 * @returns Transpiled JavaScript code
 */
export function transpileCode(code: string, language: string): string {
  // For now, just strip TypeScript type annotations
  if (!["typescript", "ts", "tsx"].includes(language)) {
    return code;
  }

  let result = code;

  // Remove type imports
  result = result.replace(
    /import\s+type\s+.*?from\s+['"].*?['"];?\n?/g,
    ""
  );

  // Remove interface and type declarations
  result = result.replace(
    /^(export\s+)?(interface|type)\s+\w+.*?(?=\n(export|const|function|class|import|$))/gms,
    ""
  );

  // Remove type annotations from variables
  result = result.replace(
    /:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(?=\s*[=;,)])/g,
    ""
  );

  // Remove type parameters
  result = result.replace(/<[^>]+>(?=\s*\()/g, "");

  // Remove return type annotations
  result = result.replace(
    /\):\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*\s*(?=[{=])/g,
    ") "
  );

  // Remove 'as' type assertions
  result = result.replace(/\s+as\s+\w+(\[\])?/g, "");

  return result;
}

/**
 * List directory contents recursively
 *
 * @param dir - Directory to list
 * @param prefix - Prefix for indentation
 * @returns Formatted directory listing
 */
export function listDirectory(dir: string, prefix: string = ""): string[] {
  const lines: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      lines.push(`${prefix}${entry.name}/`);
      lines.push(...listDirectory(path.join(dir, entry.name), prefix + "  "));
    } else {
      const stats = fs.statSync(path.join(dir, entry.name));
      const size = formatBytes(stats.size);
      lines.push(`${prefix}${entry.name} (${size})`);
    }
  }

  return lines;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create default logger that writes to console
 */
function createDefaultLogger(): DeployLogger {
  return {
    info: (msg) => console.log(`[deploy] ${msg}`),
    warn: (msg) => console.warn(`[deploy] WARN: ${msg}`),
    error: (msg) => console.error(`[deploy] ERROR: ${msg}`),
    debug: (msg) => {
      if (process.env.DEBUG) {
        console.log(`[deploy] DEBUG: ${msg}`);
      }
    },
  };
}
