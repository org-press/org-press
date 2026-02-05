/**
 * Lint Command (`orgp lint`)
 *
 * Lints code blocks in org files using ESLint.
 *
 * Usage:
 *   orgp lint                      # Lint all blocks
 *   orgp lint --fix                # Auto-fix problems
 *   orgp lint --languages ts,tsx   # Lint only TypeScript
 *   orgp lint content/api.org      # Lint specific files
 */

import * as path from "node:path";
import {
  loadToolConfig,
  isLintableLanguage,
  getExtensionForLanguage,
  type ToolConfig,
} from "../config-loader.ts";
import { collectBlocks, type CollectedBlock } from "./fmt.ts";
import { writeBlockContent } from "../../content/block-io.ts";

// ============================================================================
// Types
// ============================================================================

export interface LintOptions {
  /** Files/patterns to lint (default: all .org in content dir) */
  files?: string[];
  /** Auto-fix problems */
  fix?: boolean;
  /** Specific languages to lint */
  languages?: string[];
  /** Project root directory */
  projectRoot?: string;
  /** Content directory */
  contentDir?: string;
  /** Maximum number of warnings before failing (default: unlimited) */
  maxWarnings?: number;
}

export interface LintMessage {
  /** Line number in block (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** End line if available */
  endLine?: number;
  /** End column if available */
  endColumn?: number;
  /** Error message */
  message: string;
  /** Rule ID (e.g., "no-unused-vars") */
  ruleId: string | null;
  /** Severity: 1 = warning, 2 = error */
  severity: 1 | 2;
  /** Fixed text if fixable */
  fix?: {
    range: [number, number];
    text: string;
  };
}

export interface LintResult {
  /** Org file path */
  file: string;
  /** Block name or index */
  block: string | number;
  /** Block language */
  language: string;
  /** Line in org file where block starts (1-based) */
  orgStartLine: number;
  /** Lint messages */
  messages: LintMessage[];
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Fixable error count */
  fixableErrorCount: number;
  /** Fixable warning count */
  fixableWarningCount: number;
  /** Fixed source (if --fix was used) */
  output?: string;
}

export interface LintSummary {
  /** Total blocks processed */
  total: number;
  /** Blocks with errors */
  blocksWithErrors: number;
  /** Blocks with warnings only */
  blocksWithWarnings: number;
  /** Blocks that passed */
  blocksPassed: number;
  /** Blocks that were skipped (unsupported language) */
  skipped: number;
  /** Total error count across all blocks */
  totalErrors: number;
  /** Total warning count across all blocks */
  totalWarnings: number;
  /** Total fixable errors */
  totalFixableErrors: number;
  /** Total fixable warnings */
  totalFixableWarnings: number;
  /** Individual results */
  results: LintResult[];
}

// ============================================================================
// ESLint Integration
// ============================================================================

/**
 * Create an ESLint instance
 */
async function createESLint(
  config: ToolConfig,
  options: { fix?: boolean }
): Promise<any> {
  try {
    // Dynamic import of eslint to avoid bundling issues
    const { ESLint } = await import("eslint");

    // Create ESLint instance
    const eslintOptions: any = {
      fix: options.fix ?? false,
      // Let ESLint find its own config from cwd
      cwd: config.projectRoot,
    };

    // If we detected a config path, use overrideConfigFile for flat config
    if (config.eslint?.configPath) {
      if (config.eslint.isFlatConfig) {
        eslintOptions.overrideConfigFile = config.eslint.configPath;
      }
      // For legacy config, ESLint will find it automatically from cwd
    }

    return new ESLint(eslintOptions);
  } catch (error) {
    // ESLint not installed
    throw new Error(
      "ESLint is not installed. Please install it with: npm install eslint"
    );
  }
}

/**
 * Lint a single code block
 */
async function lintBlock(
  block: CollectedBlock,
  eslint: any,
  config: ToolConfig
): Promise<LintResult> {
  const ext = getExtensionForLanguage(block.language);
  // Create a virtual filename for ESLint to determine parser
  const virtualPath = `${block.orgFilePath}__block_${block.blockIndex}.${ext}`;

  try {
    const results = await eslint.lintText(block.content, {
      filePath: virtualPath,
    });

    const result = results[0];

    // Map messages to our format
    const messages: LintMessage[] = (result?.messages || []).map((msg: any) => ({
      line: msg.line,
      column: msg.column,
      endLine: msg.endLine,
      endColumn: msg.endColumn,
      message: msg.message,
      ruleId: msg.ruleId,
      severity: msg.severity as 1 | 2,
      fix: msg.fix,
    }));

    return {
      file: block.relativePath,
      block: block.blockName || block.blockIndex,
      language: block.language,
      orgStartLine: block.startLine,
      messages,
      errorCount: result?.errorCount || 0,
      warningCount: result?.warningCount || 0,
      fixableErrorCount: result?.fixableErrorCount || 0,
      fixableWarningCount: result?.fixableWarningCount || 0,
      output: result?.output,
    };
  } catch (error) {
    // Return as error
    return {
      file: block.relativePath,
      block: block.blockName || block.blockIndex,
      language: block.language,
      orgStartLine: block.startLine,
      messages: [
        {
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : String(error),
          ruleId: null,
          severity: 2,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
    };
  }
}

/**
 * Format a lint message for console output
 */
function formatMessage(
  result: LintResult,
  msg: LintMessage
): string {
  const severity = msg.severity === 2 ? "error" : "warning";
  const orgLine = result.orgStartLine + msg.line;
  const ruleId = msg.ruleId ? ` (${msg.ruleId})` : "";
  return `  ${result.file}:${orgLine}:${msg.column} ${severity}: ${msg.message}${ruleId}`;
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Lint code blocks in org files
 *
 * @param options - Lint options
 * @returns Summary of linting results
 */
export async function lintOrgFiles(options: LintOptions): Promise<LintSummary> {
  const projectRoot = options.projectRoot || process.cwd();
  const contentDir = options.contentDir || "content";
  const fix = options.fix ?? false;
  const maxWarnings = options.maxWarnings;

  console.log(`\n[lint] ${fix ? "Linting and fixing" : "Linting"} code blocks...\n`);

  // Load tool configuration
  const config = await loadToolConfig(projectRoot);

  // Check if ESLint config exists
  if (!config.eslint) {
    console.log("[lint] No ESLint configuration found. Using ESLint defaults.\n");
  }

  // Create ESLint instance
  let eslint: any;
  try {
    eslint = await createESLint(config, { fix });
  } catch (error) {
    console.error(`[lint] ${error instanceof Error ? error.message : error}\n`);
    return {
      total: 0,
      blocksWithErrors: 0,
      blocksWithWarnings: 0,
      blocksPassed: 0,
      skipped: 0,
      totalErrors: 1,
      totalWarnings: 0,
      totalFixableErrors: 0,
      totalFixableWarnings: 0,
      results: [],
    };
  }

  // Determine which languages to lint
  const languages = options.languages || ["ts", "tsx", "js", "jsx", "typescript", "javascript"];

  // Collect blocks
  const blocks = collectBlocks(contentDir, projectRoot, {
    files: options.files,
    languages,
  });

  if (blocks.length === 0) {
    console.log("[lint] No code blocks found.\n");
    return {
      total: 0,
      blocksWithErrors: 0,
      blocksWithWarnings: 0,
      blocksPassed: 0,
      skipped: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalFixableErrors: 0,
      totalFixableWarnings: 0,
      results: [],
    };
  }

  console.log(`[lint] Found ${blocks.length} code block(s)\n`);

  const results: LintResult[] = [];
  let blocksWithErrors = 0;
  let blocksWithWarnings = 0;
  let blocksPassed = 0;
  let skipped = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFixableErrors = 0;
  let totalFixableWarnings = 0;

  // Process each block
  for (const block of blocks) {
    // Skip non-lintable languages
    if (!isLintableLanguage(block.language)) {
      skipped++;
      continue;
    }

    const result = await lintBlock(block, eslint, config);
    results.push(result);

    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;
    totalFixableErrors += result.fixableErrorCount;
    totalFixableWarnings += result.fixableWarningCount;

    if (result.errorCount > 0) {
      blocksWithErrors++;
    } else if (result.warningCount > 0) {
      blocksWithWarnings++;
    } else {
      blocksPassed++;
    }

    // Print messages
    for (const msg of result.messages) {
      console.log(formatMessage(result, msg));
    }

    // Write fixes back if --fix and there's output
    if (fix && result.output && result.output !== block.content) {
      const writeResult = writeBlockContent({
        file: block.orgFilePath,
        block: block.blockIndex,
        content: result.output,
      });

      if (writeResult.success) {
        console.log(`  ✓ Fixed ${result.file}:${result.orgStartLine} (${block.blockName || `block ${block.blockIndex}`})`);
      } else {
        console.log(`  ✗ Failed to write fix: ${writeResult.error}`);
      }
    }
  }

  // Print summary
  console.log("\n[lint] Summary:");
  console.log(`  Total blocks:  ${blocks.length}`);
  console.log(`  With errors:   ${blocksWithErrors}`);
  console.log(`  With warnings: ${blocksWithWarnings}`);
  console.log(`  Passed:        ${blocksPassed}`);
  if (skipped > 0) {
    console.log(`  Skipped:       ${skipped} (unsupported language)`);
  }
  console.log("");
  console.log(`  Total errors:   ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);
  if (fix) {
    console.log(`  Fixed errors:   ${totalFixableErrors}`);
    console.log(`  Fixed warnings: ${totalFixableWarnings}`);
  } else if (totalFixableErrors + totalFixableWarnings > 0) {
    console.log(`  Fixable:        ${totalFixableErrors + totalFixableWarnings} (run with --fix)`);
  }
  console.log("");

  // Check max warnings
  if (maxWarnings !== undefined && totalWarnings > maxWarnings) {
    console.log(`[lint] Too many warnings (${totalWarnings}). Maximum allowed is ${maxWarnings}.\n`);
  }

  return {
    total: blocks.length,
    blocksWithErrors,
    blocksWithWarnings,
    blocksPassed,
    skipped,
    totalErrors,
    totalWarnings,
    totalFixableErrors,
    totalFixableWarnings,
    results,
  };
}

/**
 * Run lint command from CLI arguments
 *
 * @param args - CLI arguments
 * @param context - CLI context with project paths
 * @returns Exit code (0 for success, 1 for errors)
 */
export async function runLint(
  args: string[],
  context: { contentDir: string; projectRoot: string }
): Promise<number> {
  const options = parseLintArgs(args);

  const summary = await lintOrgFiles({
    ...options,
    contentDir: context.contentDir,
    projectRoot: context.projectRoot,
  });

  // Exit 1 if there are errors
  if (summary.totalErrors > 0) {
    return 1;
  }

  // Exit 1 if max warnings exceeded
  if (options.maxWarnings !== undefined && summary.totalWarnings > options.maxWarnings) {
    return 1;
  }

  return 0;
}

/**
 * Parse lint command arguments
 */
function parseLintArgs(args: string[]): LintOptions {
  const result: LintOptions = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--fix" || arg === "-f") {
      result.fix = true;
    } else if (arg === "--languages" || arg === "-l") {
      const next = args[++i];
      if (next) {
        result.languages = next.split(",").map((l) => l.trim());
      }
    } else if (arg.startsWith("--languages=")) {
      result.languages = arg
        .slice("--languages=".length)
        .split(",")
        .map((l) => l.trim());
    } else if (arg === "--max-warnings" || arg === "-w") {
      const next = args[++i];
      if (next) {
        result.maxWarnings = parseInt(next, 10);
      }
    } else if (arg.startsWith("--max-warnings=")) {
      result.maxWarnings = parseInt(arg.slice("--max-warnings=".length), 10);
    } else if (!arg.startsWith("-")) {
      files.push(arg);
    }
  }

  if (files.length > 0) {
    result.files = files;
  }

  return result;
}
