/**
 * Block I/O Utilities
 *
 * Read and write code block content in org files.
 * Used by preview:api handlers to persist changes.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface WriteBlockOptions {
  /** Org file path (relative to content dir or absolute) */
  file: string;

  /** Block name (from #+NAME:) or 0-based index */
  block: string | number;

  /** New content for the block body */
  content: string;

  /** Content directory (for relative paths) */
  contentDir?: string;
}

export interface WriteBlockResult {
  success: boolean;
  error?: string;
  /** Line number where block was found */
  line?: number;
}

export interface ReadBlockOptions {
  /** Org file path */
  file: string;

  /** Block name or index */
  block: string | number;

  /** Content directory */
  contentDir?: string;
}

export interface BlockLocation {
  /** Start line of #+begin_src (0-indexed) */
  startLine: number;

  /** End line of #+end_src (0-indexed) */
  endLine: number;

  /** Content start line (first line after #+begin_src) */
  contentStartLine: number;

  /** Content end line (last line before #+end_src) */
  contentEndLine: number;

  /** Block name if present */
  name?: string;

  /** Block language */
  language: string;

  /** Block parameters */
  params: string;
}

/**
 * Find a code block in an org file by name or index
 */
export function findBlock(
  content: string,
  blockIdentifier: string | number
): BlockLocation | null {
  const lines = content.split("\n");
  let currentBlockIndex = 0;
  let pendingName: string | undefined;

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
      const language = beginMatch[1];
      const params = beginMatch[2] || "";
      const blockName = pendingName;

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

      // Check if this is the block we're looking for
      const isMatch =
        typeof blockIdentifier === "number"
          ? currentBlockIndex === blockIdentifier
          : blockName === blockIdentifier;

      if (isMatch) {
        return {
          startLine: i,
          endLine,
          contentStartLine: i + 1,
          contentEndLine: endLine - 1,
          name: blockName,
          language,
          params,
        };
      }

      currentBlockIndex++;
      pendingName = undefined;
    }
  }

  return null;
}

/**
 * Read the content of a code block
 */
export function readBlockContent(options: ReadBlockOptions): string | null {
  const { file, block, contentDir } = options;

  const filePath = path.isAbsolute(file)
    ? file
    : path.resolve(contentDir || process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const location = findBlock(content, block);

  if (!location) {
    return null;
  }

  const lines = content.split("\n");
  const blockLines = lines.slice(location.contentStartLine, location.contentEndLine + 1);
  return blockLines.join("\n");
}

/**
 * Write new content to a code block
 *
 * Preserves:
 * - #+NAME: directive
 * - #+begin_src line with language and params
 * - #+end_src line
 *
 * Only replaces the content between begin and end.
 */
export function writeBlockContent(options: WriteBlockOptions): WriteBlockResult {
  const { file, block, content, contentDir } = options;

  const filePath = path.isAbsolute(file)
    ? file
    : path.resolve(contentDir || process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const location = findBlock(fileContent, block);

  if (!location) {
    return {
      success: false,
      error: `Block not found: ${typeof block === "number" ? `index ${block}` : block}`,
    };
  }

  const lines = fileContent.split("\n");

  // Build new file content
  const beforeBlock = lines.slice(0, location.contentStartLine);
  const afterBlock = lines.slice(location.contentEndLine + 1);

  // Format the new content (ensure it doesn't have trailing newline issues)
  const newContentLines = content.split("\n");

  const newLines = [...beforeBlock, ...newContentLines, ...afterBlock];
  const newFileContent = newLines.join("\n");

  // Write back to file
  fs.writeFileSync(filePath, newFileContent, "utf-8");

  return { success: true, line: location.startLine + 1 };
}

/**
 * Async wrapper for writeBlockContent (for API handlers)
 */
export async function dangerousWriteContentBlock(
  options: WriteBlockOptions
): Promise<WriteBlockResult> {
  return writeBlockContent(options);
}

/**
 * Async wrapper for readBlockContent (for API handlers)
 */
export async function readContentBlock(
  options: ReadBlockOptions
): Promise<string | null> {
  return readBlockContent(options);
}
