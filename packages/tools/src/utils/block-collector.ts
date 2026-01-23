/**
 * Block Collector
 *
 * Scans org files for code blocks and collects them for processing
 * by formatting, linting, and type-checking tools.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import type { CollectedBlock, CollectOptions } from "../types.js";

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
        `[tools] Warning: Failed to parse ${orgFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return allBlocks;
}
