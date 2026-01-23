/**
 * Block Writer
 *
 * Updates code block content in org files while preserving the org structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CollectedBlock } from "../types.js";

/**
 * Write updated content back to a code block in an org file
 *
 * @param block - The block to update (must have orgFilePath, startLine, endLine)
 * @param newContent - The new code content to write
 * @param projectRoot - Project root directory
 */
export function writeBlockContent(
  block: CollectedBlock,
  newContent: string,
  projectRoot: string = process.cwd()
): void {
  const absolutePath = path.isAbsolute(block.orgFilePath)
    ? block.orgFilePath
    : path.join(projectRoot, block.orgFilePath);

  const fileContent = fs.readFileSync(absolutePath, "utf-8");
  const lines = fileContent.split("\n");

  // Find the #+begin_src line and #+end_src line
  // startLine and endLine are 1-based
  const beginLineIndex = block.startLine - 1;
  const endLineIndex = block.endLine - 1;

  // Validate we're modifying the correct lines
  if (
    beginLineIndex < 0 ||
    endLineIndex >= lines.length ||
    beginLineIndex >= endLineIndex
  ) {
    throw new Error(
      `Invalid block position in ${block.orgFilePath}: lines ${block.startLine}-${block.endLine}`
    );
  }

  const beginLine = lines[beginLineIndex];
  const endLine = lines[endLineIndex];

  if (!beginLine.match(/^\s*#\+begin_src\s+\w+/i)) {
    throw new Error(
      `Expected #+begin_src at line ${block.startLine} in ${block.orgFilePath}, found: ${beginLine}`
    );
  }

  if (!endLine.match(/^\s*#\+end_src\s*$/i)) {
    throw new Error(
      `Expected #+end_src at line ${block.endLine} in ${block.orgFilePath}, found: ${endLine}`
    );
  }

  // Build the new file content
  // Keep everything before #+begin_src (including the line itself)
  // Replace content between #+begin_src and #+end_src
  // Keep everything from #+end_src onwards

  const beforeBlock = lines.slice(0, beginLineIndex + 1);
  const afterBlock = lines.slice(endLineIndex);

  // Ensure newContent ends without trailing newline (we'll join with \n)
  const trimmedContent = newContent.replace(/\n$/, "");

  // Build new content - the code goes between begin_src and end_src
  const newLines = [...beforeBlock, trimmedContent, ...afterBlock];

  fs.writeFileSync(absolutePath, newLines.join("\n"), "utf-8");
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
          `[tools] Warning: Invalid block position in ${filePath}: lines ${block.startLine}-${block.endLine}`
        );
        continue;
      }

      const beginLine = lines[beginLineIndex];
      const endLine = lines[endLineIndex];

      if (!beginLine.match(/^\s*#\+begin_src\s+\w+/i)) {
        console.warn(
          `[tools] Warning: Expected #+begin_src at line ${block.startLine} in ${filePath}`
        );
        continue;
      }

      if (!endLine.match(/^\s*#\+end_src\s*$/i)) {
        console.warn(
          `[tools] Warning: Expected #+end_src at line ${block.endLine} in ${filePath}`
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
