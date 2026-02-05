/**
 * Utilities for @org-press/lint
 *
 * Block collection, writing, and config loading functions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import type { CollectedBlock, CollectOptions } from "./types.js";

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
 * Extract code blocks from a single org file
 */
function extractBlocksFromFile(
  orgFilePath: string,
  projectRoot: string,
  options?: CollectOptions
): CollectedBlock[] {
  const absolutePath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.join(projectRoot, orgFilePath);
  const relativePath = path.relative(projectRoot, absolutePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  const lines = content.split("\n");
  const ast = parse(content) as OrgData;

  const blocks: CollectedBlock[] = [];
  let blockIndex = 0;

  // Find block positions and names by scanning raw content
  const blockPositions: Array<{
    startLine: number;
    endLine: number;
    name?: string;
    language: string;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const beginMatch = line.match(/^\s*#\+begin_src\s+(\w+)(.*)$/i);

    if (beginMatch) {
      const language = beginMatch[1].toLowerCase();

      // Look backwards for #+NAME: directive
      let name: string | undefined;
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        const nameMatch = prevLine.match(/^#\+name:\s*(.+)$/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
          break;
        }
        // Stop looking if we hit a non-comment, non-empty line
        if (prevLine && !prevLine.startsWith("#")) break;
      }

      // Find matching #+end_src
      let endLine = i;
      for (let k = i + 1; k < lines.length; k++) {
        if (lines[k].match(/^\s*#\+end_src\s*$/i)) {
          endLine = k;
          break;
        }
      }

      blockPositions.push({
        startLine: i + 1, // 1-based
        endLine: endLine + 1, // 1-based
        name,
        language,
      });
    }
  }

  // Walk AST and match blocks with their positions
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const nodeObj = node as Record<string, unknown>;

    if (nodeObj.type === "src-block") {
      const position = blockPositions[blockIndex];
      if (!position) {
        blockIndex++;
        return;
      }

      const language = (nodeObj.language as string)?.toLowerCase() || "";

      // Filter by language if specified
      if (
        options?.languages &&
        options.languages.length > 0 &&
        !options.languages.includes(language)
      ) {
        blockIndex++;
        return;
      }

      blocks.push({
        orgFilePath: relativePath,
        blockIndex,
        blockName: position.name,
        code: (nodeObj.value as string) || "",
        language,
        startLine: position.startLine,
        endLine: position.endLine,
      });

      blockIndex++;
    }

    // Recurse into children
    if (nodeObj.children && Array.isArray(nodeObj.children)) {
      for (const child of nodeObj.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Collect all code blocks from a content directory
 *
 * @param contentDir - Content directory to scan
 * @param projectRoot - Project root directory
 * @param options - Collection options
 * @returns Array of collected code blocks
 */
export async function collectCodeBlocks(
  contentDir: string,
  projectRoot: string = process.cwd(),
  options?: CollectOptions
): Promise<CollectedBlock[]> {
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
        // Support both exact match and contains match
        if (pattern.endsWith(".org")) {
          return file === pattern || file.endsWith(pattern);
        }
        return file.includes(pattern);
      })
    );
  }

  const allBlocks: CollectedBlock[] = [];

  // Process each file
  for (const orgFile of orgFiles) {
    try {
      const blocks = extractBlocksFromFile(orgFile, projectRoot, options);
      allBlocks.push(...blocks);
    } catch (error) {
      console.warn(
        `[lint] Warning: Failed to parse ${orgFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return allBlocks;
}

/**
 * Batch write multiple block updates to minimize file I/O
 *
 * Updates are grouped by file and applied in reverse order
 * (to preserve line numbers for earlier blocks in the same file)
 *
 * @param updates - Array of {block, newContent} pairs
 * @param projectRoot - Project root directory
 */
export function writeBlockContentBatch(
  updates: Array<{ block: CollectedBlock; newContent: string }>,
  projectRoot: string = process.cwd()
): void {
  // Group updates by file
  const byFile = new Map<string, Array<{ block: CollectedBlock; newContent: string }>>();

  for (const update of updates) {
    const filePath = update.block.orgFilePath;
    if (!byFile.has(filePath)) {
      byFile.set(filePath, []);
    }
    byFile.get(filePath)!.push(update);
  }

  // Process each file
  for (const [filePath, fileUpdates] of byFile) {
    // Sort by blockIndex in reverse order so we can apply changes
    // from the end of the file backwards (preserving line numbers)
    fileUpdates.sort((a, b) => b.block.blockIndex - a.block.blockIndex);

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectRoot, filePath);

    let fileContent = fs.readFileSync(absolutePath, "utf-8");
    let lines = fileContent.split("\n");

    for (const { block, newContent } of fileUpdates) {
      const beginLineIndex = block.startLine - 1;
      const endLineIndex = block.endLine - 1;

      // Validate
      if (
        beginLineIndex < 0 ||
        endLineIndex >= lines.length ||
        beginLineIndex >= endLineIndex
      ) {
        console.warn(
          `[lint] Warning: Invalid block position in ${filePath}: lines ${block.startLine}-${block.endLine}`
        );
        continue;
      }

      const beginLine = lines[beginLineIndex];
      const endLine = lines[endLineIndex];

      if (!beginLine.match(/^\s*#\+begin_src\s+\w+/i)) {
        console.warn(
          `[lint] Warning: Expected #+begin_src at line ${block.startLine} in ${filePath}`
        );
        continue;
      }

      if (!endLine.match(/^\s*#\+end_src\s*$/i)) {
        console.warn(
          `[lint] Warning: Expected #+end_src at line ${block.endLine} in ${filePath}`
        );
        continue;
      }

      // Replace content
      const trimmedContent = newContent.replace(/\n$/, "");
      const beforeBlock = lines.slice(0, beginLineIndex + 1);
      const afterBlock = lines.slice(endLineIndex);
      lines = [...beforeBlock, trimmedContent, ...afterBlock];
    }

    fs.writeFileSync(absolutePath, lines.join("\n"), "utf-8");
  }
}

/**
 * Check if ESLint flat config exists
 *
 * @param projectRoot - Project root directory
 * @returns Path to ESLint config if found, null otherwise
 */
export function findEslintConfig(projectRoot: string): string | null {
  const configFiles = [
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    // Legacy configs
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc",
  ];

  for (const configFile of configFiles) {
    const configPath = path.join(projectRoot, configFile);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
