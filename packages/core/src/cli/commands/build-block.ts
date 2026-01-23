/**
 * Build Block Command
 *
 * Extracts named blocks from org files and compiles to publishable JavaScript
 * modules with TypeScript declarations.
 *
 * Usage:
 *   orgp build <file> --block <names> [options]
 *
 * Options:
 *   --block, -b <names>       Block names to extract (comma-separated)
 *   --out, -o <dir>           Output directory (default: "dist")
 *   --format <format>         Output format: esm | cjs (default: "esm")
 *   --declaration, -d         Generate .d.ts files (default: true)
 *   --quiet, -q               Suppress non-error output
 *   --help, -h                Show help
 *
 * Examples:
 *   orgp build index.org --block plugin --out dist/
 *   orgp build index.org --block plugin,wrapper --out dist/ --format esm
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { transformWithEsbuild } from "vite";
import { parseBlockParameters } from "../../plugins/utils.ts";

/**
 * Options for build-block command
 */
export interface BuildBlockOptions {
  /** Path to org file */
  file: string;
  /** Block names to extract (comma-separated) */
  blocks: string[];
  /** Output directory */
  outDir: string;
  /** Output format */
  format: "esm" | "cjs";
  /** Generate .d.ts files */
  declaration: boolean;
  /** Suppress non-error output */
  quiet: boolean;
}

/**
 * Result of block extraction
 */
export interface ExtractedBlock {
  /** Block name from #+NAME: directive */
  name: string;
  /** Block language */
  language: string;
  /** Block source code */
  code: string;
  /** Block parameters */
  parameters: Record<string, any>;
  /** Block index in org file */
  index: number;
}

/**
 * Result of build-block command
 */
export interface BuildBlockResult {
  /** Output directory path */
  outDir: string;
  /** Generated files */
  files: Array<{
    name: string;
    path: string;
    type: "js" | "dts";
  }>;
}

/**
 * Parse command line arguments for build-block
 *
 * @param args - Command line arguments (after "build")
 * @returns Parsed options or null if not a --block invocation
 */
export function parseBuildBlockArgs(args: string[]): BuildBlockOptions | null {
  let file: string | undefined;
  let blocks: string[] = [];
  let outDir = "dist";
  let format: "esm" | "cjs" = "esm";
  let declaration = true;
  let quiet = false;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--block" || arg === "-b") {
      const blockArg = args[++i];
      if (blockArg) {
        blocks = blockArg.split(",").map((b) => b.trim());
      }
      i++;
      continue;
    }

    if (arg.startsWith("--block=")) {
      blocks = arg.slice("--block=".length).split(",").map((b) => b.trim());
      i++;
      continue;
    }

    if (arg === "--out" || arg === "-o") {
      outDir = args[++i] || "dist";
      i++;
      continue;
    }

    if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length);
      i++;
      continue;
    }

    if (arg === "--format" || arg === "-f") {
      const formatArg = args[++i];
      if (formatArg === "esm" || formatArg === "cjs") {
        format = formatArg;
      }
      i++;
      continue;
    }

    if (arg.startsWith("--format=")) {
      const formatArg = arg.slice("--format=".length);
      if (formatArg === "esm" || formatArg === "cjs") {
        format = formatArg;
      }
      i++;
      continue;
    }

    if (arg === "--declaration" || arg === "-d") {
      declaration = true;
      i++;
      continue;
    }

    if (arg === "--no-declaration") {
      declaration = false;
      i++;
      continue;
    }

    if (arg === "--quiet" || arg === "-q") {
      quiet = true;
      i++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      showBuildBlockHelp();
      process.exit(0);
    }

    // Positional argument: file path
    if (!arg.startsWith("-") && arg.endsWith(".org")) {
      file = arg;
      i++;
      continue;
    }

    i++;
  }

  // Not a --block invocation if no blocks specified
  if (blocks.length === 0) {
    return null;
  }

  if (!file) {
    console.error("Error: No org file specified");
    console.error('Run "orgp build --help" for usage');
    process.exit(1);
  }

  return {
    file,
    blocks,
    outDir,
    format,
    declaration,
    quiet,
  };
}

/**
 * Show help for build-block command
 */
export function showBuildBlockHelp(): void {
  console.log(`
orgp build --block - Extract and compile named blocks from org files

USAGE:
  orgp build <file.org> --block <names> [options]

OPTIONS:
  --block, -b <names>       Block names to extract (comma-separated)
                            Required.

  --out, -o <dir>           Output directory for compiled files
                            Default: "dist"

  --format <format>         Output format: esm | cjs
                            Default: "esm"

  --declaration, -d         Generate TypeScript declaration files
                            Default: enabled

  --no-declaration          Disable .d.ts generation

  --quiet, -q               Suppress non-error output

  --help, -h                Show this help message

EXAMPLES:
  # Extract a single block
  orgp build index.org --block plugin --out dist/

  # Extract multiple blocks
  orgp build index.org --block plugin,wrapper --out dist/

  # CommonJS format without declarations
  orgp build index.org --block plugin --format cjs --no-declaration

OUTPUT:
  Creates JavaScript files for each named block.
  TypeScript blocks are compiled with esbuild.

  dist/
  ├── index.js         # Main entry (exports all blocks)
  ├── index.d.ts       # Type declarations (if --declaration)
  ├── plugin.js        # Individual block file
  └── plugin.d.ts      # Block declarations
`);
}

/**
 * Extract named code blocks from org file
 *
 * @param orgFilePath - Path to org file
 * @returns Array of extracted blocks
 */
export function extractNamedBlocks(orgFilePath: string): ExtractedBlock[] {
  const absolutePath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.resolve(process.cwd(), orgFilePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Org file not found: ${orgFilePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  const ast = parse(content) as OrgData;
  const lines = content.split("\n");
  const blocks: ExtractedBlock[] = [];

  // Extract block names from raw content
  // Note: We need to skip #+begin_src lines that are inside export blocks
  // because they are treated as text content, not actual source blocks
  const blockMetadata: Array<{ name?: string; line: number }> = [];
  let insideExportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track export blocks - content inside them is not parsed as source blocks
    if (line.match(/^\s*#\+begin_export/i)) {
      insideExportBlock = true;
      continue;
    }
    if (line.match(/^\s*#\+end_export/i)) {
      insideExportBlock = false;
      continue;
    }

    // Skip if we're inside an export block
    if (insideExportBlock) {
      continue;
    }

    // Check if this is a begin_src line
    if (line.match(/^\s*#\+begin_src/i)) {
      let blockName: string | undefined = undefined;

      // Look backwards for a #+name: directive
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        const nameMatch = prevLine.match(/^\s*#\+name:\s*(.+)/i);
        if (nameMatch) {
          blockName = nameMatch[1].trim();
          break;
        }
        // Stop if we hit a non-comment, non-empty line
        if (prevLine.trim() && !prevLine.trim().startsWith("#")) {
          break;
        }
      }

      blockMetadata.push({ name: blockName, line: i });
    }
  }

  // Traverse AST to extract block content
  let metadataIndex = 0;
  let blockIndex = 0;

  function traverse(node: any) {
    if (node.type === "src-block") {
      const metadata = blockMetadata[metadataIndex];
      const params = parseBlockParameters(node.parameters || "");
      // Check for name from: 1) text parsing, 2) AST affiliated property, 3) :name parameter
      const blockName = metadata?.name ||
                        node.affiliated?.NAME ||
                        params.name;

      if (blockName) {
        blocks.push({
          name: blockName,
          language: node.language || "",
          code: node.value || "",
          parameters: params,
          index: blockIndex,
        });
      }

      blockIndex++;
      metadataIndex++;
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return blocks;
}

/**
 * Compile TypeScript/JavaScript code with esbuild
 *
 * @param code - Source code
 * @param language - Block language
 * @param format - Output format
 * @returns Compiled JavaScript code
 */
async function compileCode(
  code: string,
  language: string,
  format: "esm" | "cjs"
): Promise<string> {
  const lang = language.toLowerCase();

  // Determine loader based on language
  const loaderMap: Record<string, "ts" | "tsx" | "jsx" | "js"> = {
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    jsx: "jsx",
    javascript: "js",
    js: "js",
  };

  const loader = loaderMap[lang];
  if (!loader) {
    // Return raw code for non-JS/TS languages
    return code;
  }

  // Use Vite's esbuild for compilation
  const filename = `block.${loader}`;
  const result = await transformWithEsbuild(code, filename, {
    target: "esnext",
    format: format === "esm" ? "esm" : "cjs",
    minify: false,
  });

  return result.code;
}

/**
 * Generate TypeScript declaration from code
 *
 * This is a simple declaration generator that extracts export signatures.
 * For full type inference, use TypeScript compiler API.
 *
 * @param code - Source code
 * @param blockName - Block name
 * @returns Declaration content
 */
function generateDeclaration(code: string, blockName: string): string {
  const lines: string[] = [];

  // Extract export default type
  const hasDefaultExport = /export\s+default\b/.test(code);

  // Extract named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
  const namedExports: string[] = [];
  let match;
  while ((match = namedExportRegex.exec(code)) !== null) {
    namedExports.push(match[1]);
  }

  // Generate declaration
  if (hasDefaultExport) {
    lines.push(`declare const ${blockName}: any;`);
    lines.push(`export default ${blockName};`);
  }

  for (const name of namedExports) {
    if (!lines.some((l) => l.includes(`export { ${name} }`))) {
      lines.push(`export declare const ${name}: any;`);
    }
  }

  // If no exports detected, create a simple default export
  if (lines.length === 0) {
    lines.push(`declare const ${blockName}: any;`);
    lines.push(`export default ${blockName};`);
  }

  return lines.join("\n");
}

/**
 * Execute build-block command
 *
 * @param options - Command options
 * @returns Build result
 */
export async function buildBlock(
  options: BuildBlockOptions
): Promise<BuildBlockResult> {
  const { file, blocks: requestedBlocks, outDir, format, declaration, quiet } = options;

  if (!quiet) {
    console.log("[org-press] Building blocks from org file...");
    console.log(`[org-press] Source: ${file}`);
    console.log(`[org-press] Output: ${outDir}/`);
    console.log(`[org-press] Blocks: ${requestedBlocks.join(", ")}`);
  }

  const startTime = Date.now();

  // Extract all named blocks from org file
  const allBlocks = extractNamedBlocks(file);

  if (!quiet && allBlocks.length === 0) {
    console.warn("[org-press] Warning: No named blocks found in org file");
  }

  // Filter to requested blocks
  const blocksToCompile = allBlocks.filter((b) =>
    requestedBlocks.includes(b.name)
  );

  // Check for missing blocks
  const foundNames = blocksToCompile.map((b) => b.name);
  const missingBlocks = requestedBlocks.filter((name) => !foundNames.includes(name));

  if (missingBlocks.length > 0) {
    const availableNames = allBlocks.map((b) => b.name).join(", ");
    throw new Error(
      `Blocks not found: ${missingBlocks.join(", ")}. Available: ${availableNames || "(none)"}`
    );
  }

  // Ensure output directory exists
  const absoluteOutDir = path.isAbsolute(outDir)
    ? outDir
    : path.resolve(process.cwd(), outDir);

  if (!fs.existsSync(absoluteOutDir)) {
    fs.mkdirSync(absoluteOutDir, { recursive: true });
  }

  const result: BuildBlockResult = {
    outDir: absoluteOutDir,
    files: [],
  };

  // Compile each block
  for (const block of blocksToCompile) {
    if (!quiet) {
      console.log(`[org-press] Compiling block: ${block.name}`);
    }

    // Compile code
    const compiledCode = await compileCode(block.code, block.language, format);

    // Write JS file
    const jsFileName = `${block.name}.js`;
    const jsFilePath = path.join(absoluteOutDir, jsFileName);
    fs.writeFileSync(jsFilePath, compiledCode, "utf-8");

    result.files.push({
      name: block.name,
      path: jsFilePath,
      type: "js",
    });

    // Generate and write declaration file
    if (declaration) {
      const dtsContent = generateDeclaration(block.code, block.name);
      const dtsFileName = `${block.name}.d.ts`;
      const dtsFilePath = path.join(absoluteOutDir, dtsFileName);
      fs.writeFileSync(dtsFilePath, dtsContent, "utf-8");

      result.files.push({
        name: block.name,
        path: dtsFilePath,
        type: "dts",
      });
    }
  }

  // Generate index file that re-exports all blocks
  const indexExports = blocksToCompile.map((block) => {
    // Use underscore-safe identifier for re-export
    const safeName = block.name.replace(/-/g, "_");
    return `export { default as ${safeName} } from "./${block.name}.js";`;
  });

  const indexContent = indexExports.join("\n") + "\n";
  const indexPath = path.join(absoluteOutDir, "index.js");
  fs.writeFileSync(indexPath, indexContent, "utf-8");

  result.files.push({
    name: "index",
    path: indexPath,
    type: "js",
  });

  // Generate index declaration
  if (declaration) {
    const indexDtsExports = blocksToCompile.map((block) => {
      const safeName = block.name.replace(/-/g, "_");
      return `export { default as ${safeName} } from "./${block.name}.js";`;
    });

    const indexDtsContent = indexDtsExports.join("\n") + "\n";
    const indexDtsPath = path.join(absoluteOutDir, "index.d.ts");
    fs.writeFileSync(indexDtsPath, indexDtsContent, "utf-8");

    result.files.push({
      name: "index",
      path: indexDtsPath,
      type: "dts",
    });
  }

  const duration = Date.now() - startTime;

  if (!quiet) {
    console.log(`[org-press] Done in ${(duration / 1000).toFixed(2)}s`);
    console.log(`[org-press] Generated ${result.files.length} files:`);
    for (const f of result.files) {
      console.log(`  - ${path.relative(process.cwd(), f.path)}`);
    }
  }

  return result;
}
