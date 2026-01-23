/**
 * Test Block Collector
 *
 * Scans org files for test blocks (`:use test`) and collects them
 * for execution by the Vitest runner.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { parseBlockParameters } from "org-press";
import type { CollectedTestBlock } from "./types.ts";

/** Languages that can contain tests */
const TEST_LANGUAGES = [
  "typescript",
  "ts",
  "tsx",
  "javascript",
  "js",
  "jsx",
];

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
 * Extract test blocks from a single org file
 */
function extractTestBlocksFromFile(
  orgFilePath: string,
  projectRoot: string
): CollectedTestBlock[] {
  const absolutePath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.join(projectRoot, orgFilePath);
  const relativePath = path.relative(projectRoot, absolutePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  const lines = content.split("\n");
  const ast = parse(content) as OrgData;

  const testBlocks: CollectedTestBlock[] = [];
  let blockIndex = 0;

  // Find block positions and names by scanning raw content
  const blockPositions: Array<{
    startLine: number;
    endLine: number;
    name?: string;
    language: string;
    parameters: string;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const beginMatch = line.match(/^\s*#\+begin_src\s+(\w+)(.*)$/i);

    if (beginMatch) {
      const language = beginMatch[1].toLowerCase();
      const parameters = beginMatch[2]?.trim() || "";

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
        parameters,
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
      const params = parseBlockParameters(
        (nodeObj.parameters as string) || null
      );

      // Only collect blocks with :use test parameter
      if (params.use === "test" && TEST_LANGUAGES.includes(language)) {
        const name = position.name || params.name;

        testBlocks.push({
          orgFilePath: relativePath,
          blockIndex,
          blockName: name,
          code: (nodeObj.value as string) || "",
          language,
        });
      }

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
  return testBlocks;
}

/**
 * Collect all test blocks from a content directory
 *
 * @param contentDir - Content directory to scan
 * @param projectRoot - Project root directory
 * @param options - Collection options
 * @returns Array of collected test blocks
 */
export async function collectTestBlocks(
  contentDir: string,
  projectRoot: string = process.cwd(),
  options?: {
    /** Filter by file path patterns */
    files?: string[];
    /** Filter by block name */
    name?: string;
  }
): Promise<CollectedTestBlock[]> {
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

  const allTestBlocks: CollectedTestBlock[] = [];

  // Process each file
  for (const orgFile of orgFiles) {
    try {
      const blocks = extractTestBlocksFromFile(orgFile, projectRoot);
      allTestBlocks.push(...blocks);
    } catch (error) {
      console.warn(
        `[block-test] Warning: Failed to parse ${orgFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Filter by block name if specified
  if (options?.name) {
    const namePattern = options.name.toLowerCase();
    return allTestBlocks.filter(
      (block) =>
        block.blockName?.toLowerCase().includes(namePattern)
    );
  }

  return allTestBlocks;
}

/**
 * Generate a virtual test file ID for a test block
 */
export function generateVirtualTestId(block: CollectedTestBlock): string {
  return `virtual:org-test:${block.orgFilePath}:${block.blockIndex}`;
}

/**
 * Check if an ID is a virtual test file ID
 */
export function isVirtualTestId(id: string): boolean {
  return id.startsWith("virtual:org-test:");
}

/**
 * Parse a virtual test file ID
 */
export function parseVirtualTestId(id: string): {
  orgFilePath: string;
  blockIndex: number;
} | null {
  if (!isVirtualTestId(id)) {
    return null;
  }

  const path = id.slice("virtual:org-test:".length);
  const lastColonIndex = path.lastIndexOf(":");

  if (lastColonIndex === -1) {
    return null;
  }

  const orgFilePath = path.slice(0, lastColonIndex);
  const blockIndex = parseInt(path.slice(lastColonIndex + 1), 10);

  if (isNaN(blockIndex)) {
    return null;
  }

  return { orgFilePath, blockIndex };
}
