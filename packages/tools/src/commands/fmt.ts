/**
 * Format Command Implementation
 *
 * Formats code blocks in org files using Prettier.
 */

import * as prettier from "prettier";
import type { CliContext } from "org-press";
import { collectCodeBlocks } from "../utils/block-collector.js";
import { writeBlockContentBatch } from "../utils/block-writer.js";
import { loadPrettierConfig } from "../utils/config-loader.js";
import { PRETTIER_PARSERS, type FmtOptions } from "../types.js";

/**
 * Parse command line arguments for fmt command
 */
export function parseFmtArgs(args: string[]): FmtOptions {
  const options: FmtOptions = {
    check: false,
    write: true,
    languages: [],
    files: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--check" || arg === "-c") {
      options.check = true;
      options.write = false;
    } else if (arg === "--write" || arg === "-w") {
      options.write = true;
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
 * Get Prettier parser for a language
 */
function getParserForLanguage(language: string): string | null {
  return PRETTIER_PARSERS[language.toLowerCase()] || null;
}

/**
 * Run the format command
 *
 * @param args - Command line arguments
 * @param ctx - CLI context
 * @returns Exit code (0 for success, 1 if check found changes)
 */
export async function runFmt(
  args: string[],
  ctx: CliContext
): Promise<number> {
  const options = parseFmtArgs(args);
  const prettierConfig = await loadPrettierConfig(ctx.projectRoot);

  // Collect blocks, filtering by language if formatting specific languages
  const collectOptions = {
    files: options.files?.length ? options.files : undefined,
    languages: options.languages?.length ? options.languages : undefined,
  };

  const blocks = await collectCodeBlocks(
    ctx.contentDir,
    ctx.projectRoot,
    collectOptions
  );

  if (blocks.length === 0) {
    console.log("[fmt] No code blocks found to format");
    return 0;
  }

  let changedCount = 0;
  let skippedCount = 0;
  const updates: Array<{ block: (typeof blocks)[0]; newContent: string }> = [];

  for (const block of blocks) {
    const parser = getParserForLanguage(block.language);

    if (!parser) {
      skippedCount++;
      continue;
    }

    try {
      const formatted = await prettier.format(block.code, {
        parser,
        ...prettierConfig,
      });

      // Prettier adds trailing newline, but we store without it
      const normalizedFormatted = formatted.replace(/\n$/, "");
      const normalizedOriginal = block.code.replace(/\n$/, "");

      if (normalizedFormatted !== normalizedOriginal) {
        changedCount++;

        if (options.check) {
          const location = block.blockName
            ? `${block.orgFilePath}:${block.startLine} (${block.blockName})`
            : `${block.orgFilePath}:${block.startLine}`;
          console.log(`[fmt] Would format: ${location}`);
        } else {
          updates.push({ block, newContent: normalizedFormatted });
        }
      }
    } catch (error) {
      const location = block.blockName
        ? `${block.orgFilePath}:${block.startLine} (${block.blockName})`
        : `${block.orgFilePath}:${block.startLine}`;
      console.warn(
        `[fmt] Warning: Failed to format ${location}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Write changes if not in check mode
  if (!options.check && updates.length > 0) {
    writeBlockContentBatch(updates, ctx.projectRoot);
  }

  // Summary
  const total = blocks.length;
  const formatted = options.check ? 0 : changedCount;
  const unchanged = total - changedCount - skippedCount;

  if (options.check) {
    if (changedCount > 0) {
      console.log(
        `[fmt] ${changedCount} block(s) need formatting (${unchanged} unchanged, ${skippedCount} skipped)`
      );
      return 1;
    } else {
      console.log(
        `[fmt] All ${unchanged} block(s) are formatted (${skippedCount} skipped)`
      );
      return 0;
    }
  } else {
    if (formatted > 0) {
      console.log(
        `[fmt] Formatted ${formatted} block(s) (${unchanged} unchanged, ${skippedCount} skipped)`
      );
    } else {
      console.log(
        `[fmt] All ${unchanged} block(s) are formatted (${skippedCount} skipped)`
      );
    }
    return 0;
  }
}
