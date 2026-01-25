/**
 * Type-Check Command Implementation
 *
 * Type-checks TypeScript code blocks using the TypeScript compiler.
 */

import * as path from "node:path";
import type { CliContext } from "org-press";
import { collectCodeBlocks } from "../utils/block-collector.js";
import { loadTsConfig } from "../utils/config-loader.js";
import { TYPECHECK_LANGUAGES, type TypeCheckOptions, type CollectedBlock } from "../types.js";

/**
 * Parse command line arguments for type-check command
 */
export function parseTypeCheckArgs(args: string[]): TypeCheckOptions {
  const options: TypeCheckOptions = {
    files: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("-")) {
      // Positional argument - file pattern
      options.files!.push(arg);
    }
  }

  return options;
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
 * Find a block by its virtual path
 */
function findBlockByVirtualPath(
  virtualPath: string,
  blocks: CollectedBlock[]
): CollectedBlock | null {
  for (const block of blocks) {
    const expectedPath = `/virtual/${block.orgFilePath}/${
      block.blockName || `block-${block.blockIndex}`
    }.ts`;
    if (virtualPath === expectedPath) {
      return block;
    }
  }
  return null;
}

/**
 * Run the type-check command
 *
 * @param args - Command line arguments
 * @param ctx - CLI context
 * @returns Exit code (0 for success, 1 if errors found)
 */
export async function runTypeCheck(
  args: string[],
  ctx: CliContext
): Promise<number> {
  const options = parseTypeCheckArgs(args);

  // Check if TypeScript is available
  let ts: typeof import("typescript");
  try {
    ts = await import("typescript");
  } catch {
    console.error("[type-check] TypeScript is not installed. Please install typescript:");
    console.error("  npm install -D typescript");
    return 1;
  }

  // Load TypeScript config
  const tsConfig = await loadTsConfig(ctx.projectRoot);
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    tsConfig.compilerOptions || {},
    ctx.projectRoot
  ).options;

  // Ensure noEmit is set
  compilerOptions.noEmit = true;

  // Collect TypeScript blocks
  const blocks = await collectCodeBlocks(ctx.contentDir, ctx.projectRoot, {
    files: options.files?.length ? options.files : undefined,
    languages: TYPECHECK_LANGUAGES,
  });

  if (blocks.length === 0) {
    console.log("[type-check] No TypeScript blocks found to check");
    return 0;
  }

  // Create virtual file system for TypeScript
  const virtualFiles = new Map<string, string>();
  for (const block of blocks) {
    const ext = block.language === "tsx" ? "tsx" : "ts";
    const virtualPath = `/virtual/${block.orgFilePath}/${
      block.blockName || `block-${block.blockIndex}`
    }.${ext}`;
    virtualFiles.set(virtualPath, block.code);
  }

  // Create compiler host with virtual files
  const host = createVirtualCompilerHost(
    ts,
    virtualFiles,
    compilerOptions,
    ctx.projectRoot
  );

  // Create program
  const program = ts.createProgram(
    Array.from(virtualFiles.keys()),
    compilerOptions,
    host
  );

  // Get diagnostics
  const diagnostics = ts.getPreEmitDiagnostics(program);

  let errorCount = 0;
  let warningCount = 0;

  for (const diag of diagnostics) {
    if (diag.file && diag.start !== undefined) {
      // Map back to org file position
      const block = findBlockByVirtualPath(diag.file.fileName, blocks);

      if (block) {
        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        const orgLine = block.startLine + pos.line + 1;
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        const category =
          diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";

        console.log(
          `${block.orgFilePath}:${orgLine}:${pos.character + 1} ${category}: ${message}`
        );
      } else {
        // Diagnostic from a non-virtual file (e.g., type definitions)
        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        const category =
          diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";

        console.log(
          `${diag.file.fileName}:${pos.line + 1}:${pos.character + 1} ${category}: ${message}`
        );
      }
    } else {
      // Global diagnostic
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      const category =
        diag.category === ts.DiagnosticCategory.Error ? "error" : "warning";

      console.log(`${category}: ${message}`);
    }

    if (diag.category === ts.DiagnosticCategory.Error) {
      errorCount++;
    } else {
      warningCount++;
    }
  }

  // Summary
  if (errorCount > 0 || warningCount > 0) {
    console.log(
      `[type-check] Found ${errorCount} error(s) and ${warningCount} warning(s) in ${blocks.length} block(s)`
    );
  } else {
    console.log(`[type-check] No type errors in ${blocks.length} block(s)`);
  }

  return errorCount > 0 ? 1 : 0;
}
