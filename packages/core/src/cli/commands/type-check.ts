/**
 * Type-Check Command (`orgp type-check`)
 *
 * Type-checks TypeScript code blocks in org files using the TypeScript compiler.
 *
 * Usage:
 *   orgp type-check                    # Check all TS/TSX blocks
 *   orgp type-check --watch            # Watch mode
 *   orgp type-check content/api.org    # Check specific files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadToolConfig,
  type ToolConfig,
} from "../config-loader.ts";
import { collectBlocks, type CollectedBlock } from "./fmt.ts";

// ============================================================================
// Types
// ============================================================================

export interface TypeCheckOptions {
  /** Files/patterns to check (default: all .org in content dir) */
  files?: string[];
  /** Watch mode - re-check on file changes */
  watch?: boolean;
  /** Project root directory */
  projectRoot?: string;
  /** Content directory */
  contentDir?: string;
}

export interface TypeCheckDiagnostic {
  /** Org file path */
  file: string;
  /** Block name or index */
  block: string | number;
  /** Line in org file (1-based) */
  line: number;
  /** Column (1-based) */
  column: number;
  /** Error message */
  message: string;
  /** Diagnostic code */
  code: number;
  /** Severity: "error" or "warning" */
  severity: "error" | "warning";
}

export interface TypeCheckResult {
  /** Org file path */
  file: string;
  /** Block name or index */
  block: string | number;
  /** Block language */
  language: string;
  /** Line in org file where block starts (1-based) */
  orgStartLine: number;
  /** Diagnostics for this block */
  diagnostics: TypeCheckDiagnostic[];
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
}

export interface TypeCheckSummary {
  /** Total blocks processed */
  total: number;
  /** Blocks with errors */
  blocksWithErrors: number;
  /** Blocks with warnings only */
  blocksWithWarnings: number;
  /** Blocks that passed */
  blocksPassed: number;
  /** Total error count across all blocks */
  totalErrors: number;
  /** Total warning count across all blocks */
  totalWarnings: number;
  /** Individual results */
  results: TypeCheckResult[];
}

// ============================================================================
// TypeScript Integration
// ============================================================================

/** Languages that can be type-checked */
const TYPECHECK_LANGUAGES = ["typescript", "ts", "tsx"];

/**
 * Check if a language is type-checkable
 */
export function isTypeCheckableLanguage(language: string): boolean {
  return TYPECHECK_LANGUAGES.includes(language.toLowerCase());
}

/**
 * Create a virtual compiler host that serves virtual files
 */
function createVirtualCompilerHost(
  ts: typeof import("typescript"),
  virtualFiles: Map<string, string>,
  compilerOptions: import("typescript").CompilerOptions,
  projectRoot: string
) {
  const defaultHost = ts.createCompilerHost(compilerOptions);

  return {
    ...defaultHost,
    getSourceFile(
      fileName: string,
      languageVersion: import("typescript").ScriptTarget
    ) {
      // Check virtual files first
      const virtualContent = virtualFiles.get(fileName);
      if (virtualContent !== undefined) {
        return ts.createSourceFile(fileName, virtualContent, languageVersion);
      }

      // Fall back to real file system
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    fileExists(fileName: string) {
      if (virtualFiles.has(fileName)) {
        return true;
      }
      return defaultHost.fileExists(fileName);
    },
    readFile(fileName: string) {
      const virtualContent = virtualFiles.get(fileName);
      if (virtualContent !== undefined) {
        return virtualContent;
      }
      return defaultHost.readFile(fileName);
    },
    getCurrentDirectory() {
      return projectRoot;
    },
    getDefaultLibFileName: defaultHost.getDefaultLibFileName,
    writeFile: () => {},
    getCanonicalFileName: defaultHost.getCanonicalFileName,
    useCaseSensitiveFileNames: defaultHost.useCaseSensitiveFileNames,
    getNewLine: defaultHost.getNewLine,
  };
}

/**
 * Create virtual file path for a block
 * Uses path.join to avoid double-slash issues with absolute paths
 */
function getVirtualPath(block: CollectedBlock): string {
  const ext = block.language.toLowerCase() === "tsx" ? "tsx" : "ts";
  const blockId = block.blockName || `block-${block.blockIndex}`;
  // Use path.join to properly handle absolute paths (avoids //virtual//absolute/path)
  return path.join("/virtual", block.orgFilePath, `${blockId}.${ext}`);
}

/**
 * Find a block by its virtual path
 * Normalizes paths to handle potential differences in path formatting
 */
function findBlockByVirtualPath(
  virtualPath: string,
  blocks: CollectedBlock[]
): CollectedBlock | null {
  const normalizedSearch = path.normalize(virtualPath);
  for (const block of blocks) {
    const blockPath = getVirtualPath(block);
    if (blockPath === normalizedSearch || path.normalize(blockPath) === normalizedSearch) {
      return block;
    }
  }
  return null;
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Type-check TypeScript code blocks in org files
 *
 * @param options - Type-check options
 * @returns Summary of type-checking results
 */
export async function typeCheckOrgFiles(
  options: TypeCheckOptions
): Promise<TypeCheckSummary> {
  const projectRoot = options.projectRoot || process.cwd();
  const contentDir = options.contentDir || "content";

  console.log("\n[type-check] Checking TypeScript blocks...\n");

  // Check if TypeScript is available
  let ts: typeof import("typescript");
  try {
    ts = await import("typescript");
  } catch {
    console.error("[type-check] TypeScript is not installed. Please install typescript:");
    console.error("  npm install -D typescript\n");
    return {
      total: 0,
      blocksWithErrors: 0,
      blocksWithWarnings: 0,
      blocksPassed: 0,
      totalErrors: 1,
      totalWarnings: 0,
      results: [],
    };
  }

  // Load tool configuration
  const config = await loadToolConfig(projectRoot);

  // Get compiler options from tsconfig
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    config.typescript?.compilerOptions || {},
    projectRoot
  ).options;

  // Ensure noEmit is set (we're only type-checking)
  compilerOptions.noEmit = true;

  // Collect TypeScript blocks
  const blocks = collectBlocks(contentDir, projectRoot, {
    files: options.files,
    languages: TYPECHECK_LANGUAGES,
  });

  if (blocks.length === 0) {
    console.log("[type-check] No TypeScript blocks found.\n");
    return {
      total: 0,
      blocksWithErrors: 0,
      blocksWithWarnings: 0,
      blocksPassed: 0,
      totalErrors: 0,
      totalWarnings: 0,
      results: [],
    };
  }

  console.log(`[type-check] Found ${blocks.length} TypeScript block(s)\n`);

  // Create virtual file system for TypeScript
  const virtualFiles = new Map<string, string>();
  for (const block of blocks) {
    virtualFiles.set(getVirtualPath(block), block.content);
  }

  // Create compiler host with virtual files
  const host = createVirtualCompilerHost(
    ts,
    virtualFiles,
    compilerOptions,
    projectRoot
  );

  // Create program
  const program = ts.createProgram(
    Array.from(virtualFiles.keys()),
    compilerOptions,
    host
  );

  // Get diagnostics
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // Process diagnostics and group by block
  const resultsByBlock = new Map<string, TypeCheckResult>();

  // Initialize results for all blocks
  for (const block of blocks) {
    const key = getVirtualPath(block);
    resultsByBlock.set(key, {
      file: block.relativePath,
      block: block.blockName || block.blockIndex,
      language: block.language,
      orgStartLine: block.startLine,
      diagnostics: [],
      errorCount: 0,
      warningCount: 0,
    });
  }

  // Process diagnostics
  for (const diag of diagnostics) {
    if (diag.file && diag.start !== undefined) {
      const block = findBlockByVirtualPath(diag.file.fileName, blocks);

      if (block) {
        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        const orgLine = block.startLine + pos.line + 1;
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        const severity = diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";

        const result = resultsByBlock.get(getVirtualPath(block))!;
        result.diagnostics.push({
          file: block.relativePath,
          block: block.blockName || block.blockIndex,
          line: orgLine,
          column: pos.character + 1,
          message,
          code: diag.code,
          severity,
        });

        if (severity === "error") {
          result.errorCount++;
        } else {
          result.warningCount++;
        }

        // Print diagnostic
        console.log(
          `  ${block.relativePath}:${orgLine}:${pos.character + 1} ${severity}: ${message} (TS${diag.code})`
        );
      }
    } else {
      // Global diagnostic
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      const severity = diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";
      console.log(`  ${severity}: ${message} (TS${diag.code})`);
    }
  }

  // Calculate summary
  const results = Array.from(resultsByBlock.values());
  let blocksWithErrors = 0;
  let blocksWithWarnings = 0;
  let blocksPassed = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;

    if (result.errorCount > 0) {
      blocksWithErrors++;
    } else if (result.warningCount > 0) {
      blocksWithWarnings++;
    } else {
      blocksPassed++;
    }
  }

  // Print summary
  console.log("\n[type-check] Summary:");
  console.log(`  Total blocks:  ${blocks.length}`);
  console.log(`  With errors:   ${blocksWithErrors}`);
  console.log(`  With warnings: ${blocksWithWarnings}`);
  console.log(`  Passed:        ${blocksPassed}`);
  console.log("");
  console.log(`  Total errors:   ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);
  console.log("");

  return {
    total: blocks.length,
    blocksWithErrors,
    blocksWithWarnings,
    blocksPassed,
    totalErrors,
    totalWarnings,
    results,
  };
}

/**
 * Run type-check in watch mode
 */
async function runWatchMode(
  options: TypeCheckOptions
): Promise<never> {
  const projectRoot = options.projectRoot || process.cwd();
  const contentDir = options.contentDir || "content";
  const absoluteContentDir = path.isAbsolute(contentDir)
    ? contentDir
    : path.join(projectRoot, contentDir);

  console.log("[type-check] Starting watch mode...\n");
  console.log(`[type-check] Watching ${absoluteContentDir} for changes\n`);

  // Initial check
  await typeCheckOrgFiles(options);

  // Watch for changes
  const watcher = fs.watch(absoluteContentDir, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.endsWith(".org")) {
      console.log(`\n[type-check] File changed: ${filename}\n`);
      await typeCheckOrgFiles(options);
    }
  });

  // Keep process running
  process.on("SIGINT", () => {
    console.log("\n[type-check] Stopping watch mode...");
    watcher.close();
    process.exit(0);
  });

  // Return a promise that never resolves (keeps the process running)
  return new Promise(() => {});
}

/**
 * Run type-check command from CLI arguments
 *
 * @param args - CLI arguments
 * @param context - CLI context with project paths
 * @returns Exit code (0 for success, 1 for errors)
 */
export async function runTypeCheck(
  args: string[],
  context: { contentDir: string; projectRoot: string }
): Promise<number> {
  const options = parseTypeCheckArgs(args);

  if (options.watch) {
    await runWatchMode({
      ...options,
      contentDir: context.contentDir,
      projectRoot: context.projectRoot,
    });
    return 0; // Never reached in watch mode
  }

  const summary = await typeCheckOrgFiles({
    ...options,
    contentDir: context.contentDir,
    projectRoot: context.projectRoot,
  });

  // Exit 1 if there are errors
  if (summary.totalErrors > 0) {
    return 1;
  }

  return 0;
}

/**
 * Parse type-check command arguments
 */
function parseTypeCheckArgs(args: string[]): TypeCheckOptions {
  const result: TypeCheckOptions = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--watch" || arg === "-w") {
      result.watch = true;
    } else if (!arg.startsWith("-")) {
      files.push(arg);
    }
  }

  if (files.length > 0) {
    result.files = files;
  }

  return result;
}
