/**
 * Lint Command Implementation
 *
 * Lints code blocks in org files using ESLint.
 */

import type { CliContext } from "org-press";
import { collectCodeBlocks } from "../utils/block-collector.js";
import { writeBlockContentBatch } from "../utils/block-writer.js";
import { findEslintConfig } from "../utils/config-loader.js";
import { LINT_LANGUAGES, LANGUAGE_EXTENSIONS, type LintOptions } from "../types.js";

/**
 * Parse command line arguments for lint command
 */
export function parseLintArgs(args: string[]): LintOptions {
  const options: LintOptions = {
    fix: false,
    languages: [],
    files: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--fix" || arg === "-f") {
      options.fix = true;
    } else if (arg === "--languages" || arg === "-l") {
      const next = args[++i];
      if (next) {
        options.languages = next.split(",").map((l) => l.trim().toLowerCase());
      }
    } else if (!arg.startsWith("-")) {
      // Positional argument - file pattern
      options.files!.push(arg);
    }
  }

  return options;
}

/**
 * Get file extension for a language
 */
function getExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || "js";
}

/**
 * Run the lint command
 *
 * @param args - Command line arguments
 * @param ctx - CLI context
 * @returns Exit code (0 for success, 1 if errors found)
 */
export async function runLint(
  args: string[],
  ctx: CliContext
): Promise<number> {
  const options = parseLintArgs(args);

  // Check if ESLint is available
  let ESLint: typeof import("eslint").ESLint;
  try {
    const eslintModule = await import("eslint");
    ESLint = eslintModule.ESLint;
  } catch {
    console.error("[lint] ESLint is not installed. Please install eslint:");
    console.error("  npm install -D eslint");
    return 1;
  }

  // Check for ESLint config
  const configPath = findEslintConfig(ctx.projectRoot);
  if (!configPath) {
    console.warn("[lint] No ESLint configuration found. Using default settings.");
  }

  // Determine which languages to lint
  const languages =
    options.languages?.length ? options.languages : LINT_LANGUAGES;

  // Collect blocks
  const blocks = await collectCodeBlocks(ctx.contentDir, ctx.projectRoot, {
    files: options.files?.length ? options.files : undefined,
    languages,
  });

  if (blocks.length === 0) {
    console.log("[lint] No code blocks found to lint");
    return 0;
  }

  // Create ESLint instance
  const eslint = new ESLint({
    cwd: ctx.projectRoot,
    fix: options.fix,
  });

  let errorCount = 0;
  let warningCount = 0;
  const updates: Array<{ block: (typeof blocks)[0]; newContent: string }> = [];

  for (const block of blocks) {
    const ext = getExtension(block.language);
    // Use virtual filename for ESLint to apply correct rules
    const virtualPath = block.blockName
      ? `${block.orgFilePath}#${block.blockName}.${ext}`
      : `${block.orgFilePath}#block-${block.blockIndex}.${ext}`;

    try {
      const results = await eslint.lintText(block.code, {
        filePath: virtualPath,
      });

      for (const result of results) {
        // Print messages
        for (const msg of result.messages) {
          // Map line number back to org file
          const orgLine = block.startLine + msg.line;
          const severity = msg.severity === 2 ? "error" : "warning";
          const ruleId = msg.ruleId ? ` (${msg.ruleId})` : "";

          console.log(
            `${block.orgFilePath}:${orgLine}:${msg.column} ${severity}: ${msg.message}${ruleId}`
          );

          if (msg.severity === 2) {
            errorCount++;
          } else {
            warningCount++;
          }
        }

        // Collect fixes if --fix and there's output
        if (options.fix && result.output && result.output !== block.code) {
          updates.push({ block, newContent: result.output.replace(/\n$/, "") });
        }
      }
    } catch (error) {
      const location = block.blockName
        ? `${block.orgFilePath}:${block.startLine} (${block.blockName})`
        : `${block.orgFilePath}:${block.startLine}`;
      console.warn(
        `[lint] Warning: Failed to lint ${location}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Write fixes
  if (updates.length > 0) {
    writeBlockContentBatch(updates, ctx.projectRoot);
    console.log(`[lint] Fixed ${updates.length} block(s)`);
  }

  // Summary
  if (errorCount > 0 || warningCount > 0) {
    console.log(
      `[lint] Found ${errorCount} error(s) and ${warningCount} warning(s) in ${blocks.length} block(s)`
    );
  } else {
    console.log(`[lint] No issues found in ${blocks.length} block(s)`);
  }

  return errorCount > 0 ? 1 : 0;
}
