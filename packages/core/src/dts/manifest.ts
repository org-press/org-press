/**
 * Block Manifest Generator
 *
 * Generates a manifest of all code blocks in org files with
 * position information for LSP integration and DTS generation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { parseBlockParameters } from "../plugins/utils.ts";
import type { BlockInfo, BlockManifest } from "./types.ts";

/** Languages that should be processed for TypeScript/JavaScript DTS generation */
const TS_JS_LANGUAGES = [
  "typescript",
  "ts",
  "tsx",
  "javascript",
  "js",
  "jsx",
];

/** Map language names to file extensions */
const EXTENSION_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  jsx: "jsx",
  tsx: "tsx",
};

/**
 * Extract blocks from a single org file
 *
 * Parses the org file and extracts all code blocks with their
 * position information and metadata.
 *
 * @param orgFilePath - Path to the org file (absolute or relative to projectRoot)
 * @param projectRoot - Project root directory
 * @returns Array of block info objects
 */
export function extractBlocksFromFile(
  orgFilePath: string,
  projectRoot: string
): BlockInfo[] {
  const absolutePath = path.isAbsolute(orgFilePath)
    ? orgFilePath
    : path.join(projectRoot, orgFilePath);
  const relativePath = path.relative(projectRoot, absolutePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  const lines = content.split("\n");
  const ast = parse(content) as OrgData;

  const blocks: BlockInfo[] = [];
  let blockIndex = 0;

  // Find block positions by scanning raw content
  // We need to match AST blocks with their line positions
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

      // Get name from position data or parameters
      const name = position.name || params.name;

      // Determine the plugin/parser to use
      const parser = params.use || "default";

      // Get appropriate file extension
      const extension = EXTENSION_MAP[language] || "js";

      // Create virtual module ID
      const virtualModuleId = name
        ? `virtual:org-press:block:${parser}:${relativePath}:NAME:${name}.${extension}`
        : `virtual:org-press:block:${parser}:${relativePath}:${blockIndex}.${extension}`;

      blocks.push({
        id: `${relativePath}:${blockIndex}`,
        orgFilePath: relativePath,
        name,
        index: blockIndex,
        language,
        startLine: position.startLine,
        endLine: position.endLine,
        startColumn: 1,
        parameters: params,
        virtualModuleId,
        content: (nodeObj.value as string) || "",
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
 * Find all org files recursively in a directory
 *
 * @param dir - Directory to search
 * @returns Array of absolute paths to org files
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
      if (
        entry.name !== "node_modules" &&
        !entry.name.startsWith(".")
      ) {
        files.push(...findOrgFiles(fullPath));
      }
    } else if (entry.name.endsWith(".org")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Generate block manifest for an entire project
 *
 * Scans all org files in the content directory and extracts
 * block information into a manifest for DTS generation and LSP.
 *
 * @param contentDir - Content directory containing org files
 * @param projectRoot - Project root directory (defaults to cwd)
 * @returns Block manifest with all blocks indexed
 */
export async function generateBlockManifest(
  contentDir: string,
  projectRoot: string = process.cwd()
): Promise<BlockManifest> {
  const absoluteContentDir = path.isAbsolute(contentDir)
    ? contentDir
    : path.join(projectRoot, contentDir);

  const blocksByFile = new Map<string, BlockInfo[]>();
  const blocksByVirtualId = new Map<string, BlockInfo>();

  // Find all org files
  const orgFiles = findOrgFiles(absoluteContentDir);

  // Process each file
  for (const orgFile of orgFiles) {
    try {
      const blocks = extractBlocksFromFile(orgFile, projectRoot);
      const relativePath = path.relative(projectRoot, orgFile);

      blocksByFile.set(relativePath, blocks);

      for (const block of blocks) {
        blocksByVirtualId.set(block.virtualModuleId, block);
      }
    } catch (error) {
      console.warn(
        `[org-press] Warning: Failed to parse ${orgFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    version: 1,
    generatedAt: Date.now(),
    projectRoot,
    blocksByFile,
    blocksByVirtualId,
  };
}

/**
 * Filter blocks to only TypeScript/JavaScript blocks
 *
 * @param manifest - Full block manifest
 * @returns New manifest with only TS/JS blocks
 */
export function filterTsJsBlocks(manifest: BlockManifest): BlockManifest {
  const blocksByFile = new Map<string, BlockInfo[]>();
  const blocksByVirtualId = new Map<string, BlockInfo>();

  for (const [filePath, blocks] of manifest.blocksByFile) {
    const tsJsBlocks = blocks.filter((block) =>
      TS_JS_LANGUAGES.includes(block.language.toLowerCase())
    );

    if (tsJsBlocks.length > 0) {
      blocksByFile.set(filePath, tsJsBlocks);

      for (const block of tsJsBlocks) {
        blocksByVirtualId.set(block.virtualModuleId, block);
      }
    }
  }

  return {
    ...manifest,
    blocksByFile,
    blocksByVirtualId,
  };
}

/**
 * Check if a language is a TypeScript/JavaScript variant
 *
 * @param language - Language name
 * @returns True if the language is TS/JS
 */
export function isTsJsLanguage(language: string): boolean {
  return TS_JS_LANGUAGES.includes(language.toLowerCase());
}

export { TS_JS_LANGUAGES, EXTENSION_MAP };
