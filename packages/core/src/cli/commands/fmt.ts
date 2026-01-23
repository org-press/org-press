/**
 * Format Command (`orgp fmt`)
 *
 * Formats code blocks in org files using Prettier.
 *
 * Usage:
 *   orgp fmt                      # Format all blocks
 *   orgp fmt --check              # Check only, exit 1 if changes needed
 *   orgp fmt --languages ts,tsx   # Format only TypeScript
 *   orgp fmt content/api.org      # Format specific files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadToolConfig,
  getFormatterOptions,
  isFormattableLanguage,
  type ToolConfig,
} from "../config-loader.ts";
import { writeBlockContent, findBlock } from "../../content/block-io.ts";

// ============================================================================
// Types
// ============================================================================

export interface FormatOptions {
  /** Files/patterns to format (default: all .org in content dir) */
  files?: string[];
  /** Check only, don't write (exit 1 if changes needed) */
  check?: boolean;
  /** Specific languages to format */
  languages?: string[];
  /** Project root directory */
  projectRoot?: string;
  /** Content directory */
  contentDir?: string;
}

export interface FormatResult {
  /** Org file path */
  file: string;
  /** Block name or index */
  block: string | number;
  /** Block language */
  language: string;
  /** Whether the block was changed */
  changed: boolean;
  /** Error message if formatting failed */
  error?: string;
}

export interface FormatSummary {
  /** Total blocks processed */
  total: number;
  /** Blocks that were changed (or would be changed in check mode) */
  changed: number;
  /** Blocks that had errors */
  errors: number;
  /** Blocks that were unchanged */
  unchanged: number;
  /** Blocks that were skipped (unsupported language) */
  skipped: number;
  /** Individual results */
  results: FormatResult[];
}

export interface CollectedBlock {
  /** Absolute path to org file */
  orgFilePath: string;
  /** Relative path from project root */
  relativePath: string;
  /** Block index (0-based) */
  blockIndex: number;
  /** Block name if present */
  blockName?: string;
  /** Block content */
  content: string;
  /** Block language */
  language: string;
  /** Start line in org file (1-based) */
  startLine: number;
}

// ============================================================================
// Block Collection
// ============================================================================

/**
 * Find all org files recursively in a directory
 */
function findOrgFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
        files.push(...findOrgFiles(fullPath));
      }
    } else if (entry.name.endsWith(".org")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract all code blocks from an org file
 */
function extractBlocksFromFile(
  orgFilePath: string,
  projectRoot: string
): CollectedBlock[] {
  const absolutePath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.join(projectRoot, orgFilePath);
  const relativePath = path.relative(projectRoot, absolutePath);

  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const fileContent = fs.readFileSync(absolutePath, "utf-8");
  const lines = fileContent.split("\n");
  const blocks: CollectedBlock[] = [];

  let pendingName: string | undefined;
  let blockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for #+NAME: directive
    const nameMatch = line.match(/^#\+(?:NAME|name):\s*(.+)$/);
    if (nameMatch) {
      pendingName = nameMatch[1].trim();
      continue;
    }

    // Check for #+begin_src
    const beginMatch = line.match(/^#\+begin_src\s+(\w+)\s*(.*)?$/i);
    if (beginMatch) {
      const language = beginMatch[1].toLowerCase();

      // Find the matching #+end_src
      let endLine = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#\+end_src$/i)) {
          endLine = j;
          break;
        }
      }

      if (endLine === -1) {
        // Malformed block, skip
        pendingName = undefined;
        continue;
      }

      // Extract block content
      const contentLines = lines.slice(i + 1, endLine);
      const content = contentLines.join("\n");

      blocks.push({
        orgFilePath: absolutePath,
        relativePath,
        blockIndex,
        blockName: pendingName,
        content,
        language,
        startLine: i + 1, // 1-based
      });

      blockIndex++;
      pendingName = undefined;
    }
  }

  return blocks;
}

/**
 * Collect all code blocks from content directory
 */
export function collectBlocks(
  contentDir: string,
  projectRoot: string,
  options?: {
    files?: string[];
    languages?: string[];
  }
): CollectedBlock[] {
  const absoluteContentDir = path.isAbsolute(contentDir)
    ? contentDir
    : path.join(projectRoot, contentDir);

  // Find all org files
  let orgFiles = findOrgFiles(absoluteContentDir);

  // Filter by file patterns if specified
  if (options?.files && options.files.length > 0) {
    const patterns = options.files.map((f) =>
      path.isAbsolute(f) ? f : path.join(projectRoot, f)
    );

    orgFiles = orgFiles.filter((file) =>
      patterns.some((pattern) => {
        if (pattern.endsWith(".org")) {
          return file === pattern || file.endsWith(path.basename(pattern));
        }
        return file.includes(pattern);
      })
    );
  }

  const allBlocks: CollectedBlock[] = [];

  for (const orgFile of orgFiles) {
    try {
      const blocks = extractBlocksFromFile(orgFile, projectRoot);
      allBlocks.push(...blocks);
    } catch (error) {
      console.warn(
        `[fmt] Warning: Failed to parse ${orgFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Filter by language if specified
  if (options?.languages && options.languages.length > 0) {
    const langs = options.languages.map((l) => l.toLowerCase());
    return allBlocks.filter((block) => langs.includes(block.language));
  }

  return allBlocks;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a single code block
 */
async function formatBlock(
  content: string,
  language: string,
  config: ToolConfig,
  filePath?: string
): Promise<{ formatted: string; changed: boolean } | { error: string }> {
  // Get formatter options for this language
  const options = getFormatterOptions(config, language, filePath);

  if (!options) {
    return { error: `Unsupported language: ${language}` };
  }

  try {
    // Dynamic import of prettier to avoid bundling issues
    const prettier = await import("prettier");

    // Format the content
    const formatted = await prettier.format(content, options);

    // Prettier adds a trailing newline, but we want to preserve the original behavior
    // Remove trailing newline if the original didn't have one
    let finalContent = formatted;
    if (!content.endsWith("\n") && finalContent.endsWith("\n")) {
      finalContent = finalContent.slice(0, -1);
    }

    return {
      formatted: finalContent,
      changed: finalContent !== content,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Format code blocks in org files
 *
 * @param options - Format options
 * @returns Summary of formatting results
 */
export async function formatOrgFiles(
  options: FormatOptions
): Promise<FormatSummary> {
  const projectRoot = options.projectRoot || process.cwd();
  const contentDir = options.contentDir || "content";
  const check = options.check ?? false;

  console.log(`\n[fmt] ${check ? "Checking" : "Formatting"} code blocks...\n`);

  // Load tool configuration
  const config = await loadToolConfig(projectRoot);

  // Collect blocks
  const blocks = collectBlocks(contentDir, projectRoot, {
    files: options.files,
    languages: options.languages,
  });

  if (blocks.length === 0) {
    console.log("[fmt] No code blocks found.\n");
    return {
      total: 0,
      changed: 0,
      errors: 0,
      unchanged: 0,
      skipped: 0,
      results: [],
    };
  }

  console.log(`[fmt] Found ${blocks.length} code block(s)\n`);

  const results: FormatResult[] = [];
  let changed = 0;
  let errors = 0;
  let unchanged = 0;
  let skipped = 0;

  // Process each block
  for (const block of blocks) {
    const blockId = block.blockName || `block ${block.blockIndex}`;

    // Skip non-formattable languages
    if (!isFormattableLanguage(block.language)) {
      skipped++;
      continue;
    }

    const result = await formatBlock(
      block.content,
      block.language,
      config,
      block.orgFilePath
    );

    if ("error" in result) {
      errors++;
      results.push({
        file: block.relativePath,
        block: block.blockName || block.blockIndex,
        language: block.language,
        changed: false,
        error: result.error,
      });
      console.log(
        `  ✗ ${block.relativePath}:${block.startLine} (${blockId}) - ${result.error}`
      );
      continue;
    }

    if (result.changed) {
      changed++;

      if (check) {
        // Check mode: report but don't write
        console.log(
          `  ○ ${block.relativePath}:${block.startLine} (${blockId}) - needs formatting`
        );
      } else {
        // Write the formatted content back
        const writeResult = writeBlockContent({
          file: block.orgFilePath,
          block: block.blockIndex,
          content: result.formatted,
        });

        if (writeResult.success) {
          console.log(
            `  ✓ ${block.relativePath}:${block.startLine} (${blockId}) - formatted`
          );
        } else {
          errors++;
          console.log(
            `  ✗ ${block.relativePath}:${block.startLine} (${blockId}) - write failed: ${writeResult.error}`
          );
        }
      }

      results.push({
        file: block.relativePath,
        block: block.blockName || block.blockIndex,
        language: block.language,
        changed: true,
      });
    } else {
      unchanged++;
      results.push({
        file: block.relativePath,
        block: block.blockName || block.blockIndex,
        language: block.language,
        changed: false,
      });
    }
  }

  // Print summary
  console.log("\n[fmt] Summary:");
  console.log(`  Total:     ${blocks.length}`);
  console.log(`  Changed:   ${changed}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Skipped:   ${skipped} (unsupported language)`);
  if (errors > 0) {
    console.log(`  Errors:    ${errors}`);
  }
  console.log("");

  if (check && changed > 0) {
    console.log("[fmt] Some files need formatting. Run 'orgp fmt' to fix.\n");
  }

  return {
    total: blocks.length,
    changed,
    errors,
    unchanged,
    skipped,
    results,
  };
}

/**
 * Run format command from CLI arguments
 *
 * @param args - CLI arguments
 * @param context - CLI context with project paths
 * @returns Exit code (0 for success, 1 for check mode with changes)
 */
export async function runFmt(
  args: string[],
  context: { contentDir: string; projectRoot: string }
): Promise<number> {
  const options = parseFmtArgs(args);

  const summary = await formatOrgFiles({
    ...options,
    contentDir: context.contentDir,
    projectRoot: context.projectRoot,
  });

  // Exit 1 if in check mode and there are changes needed
  if (options.check && summary.changed > 0) {
    return 1;
  }

  // Exit 1 if there were errors
  if (summary.errors > 0) {
    return 1;
  }

  return 0;
}

/**
 * Parse format command arguments
 */
function parseFmtArgs(args: string[]): FormatOptions {
  const result: FormatOptions = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--check" || arg === "-c") {
      result.check = true;
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
    } else if (!arg.startsWith("-")) {
      files.push(arg);
    }
  }

  if (files.length > 0) {
    result.files = files;
  }

  return result;
}
