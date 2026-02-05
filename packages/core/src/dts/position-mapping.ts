/**
 * Position Mapping Utilities
 *
 * Maps positions between org files and virtual block files.
 * Handles bidirectional translation for LSP requests/responses.
 *
 * Key concepts:
 * - Org file positions: absolute positions in the .org file
 * - Block positions: positions within a code block's content
 * - Virtual module: the "file" that TypeScript sees for a block
 *
 * Position Translation:
 * - Org to Block: Find which block contains a position, get relative offset
 * - Block to Org: Map position in block content back to org file location
 */

import type {
  BlockInfo,
  BlockManifest,
  Position,
  Range,
  Location,
  OrgToBlockResult,
  BlockToOrgResult,
} from "./types.ts";

/**
 * Find the block containing a position in an org file
 *
 * Given a position in an org file, determines which code block (if any)
 * contains that position and calculates the relative position within
 * the block's content.
 *
 * @param orgFilePath - Relative path to the org file
 * @param position - Position in the org file (0-based)
 * @param manifest - Block manifest
 * @returns Block and relative position, or null if not in a block
 */
export function orgToBlock(
  orgFilePath: string,
  position: Position,
  manifest: BlockManifest
): OrgToBlockResult | null {
  const blocks = manifest.blocksByFile.get(orgFilePath);
  if (!blocks) return null;

  // Convert to 1-based for comparison with manifest (which uses 1-based lines)
  const line1Based = position.line + 1;

  // Find block containing this position
  // Block content starts at startLine + 1 (after #+begin_src line)
  // Block content ends at endLine - 1 (before #+end_src line)
  const block = blocks.find(
    (b) => line1Based > b.startLine && line1Based < b.endLine
  );

  if (!block) return null;

  // Map position to within the block content
  // Line in block = (org line) - (start line) - 1
  // (subtract 1 because startLine is the #+begin_src line)
  const blockLine = line1Based - block.startLine - 1;

  return {
    block,
    position: {
      line: blockLine,
      character: position.character,
    },
    virtualUri: `file://${manifest.projectRoot}/${block.virtualModuleId}`,
  };
}

/**
 * Map a position in a block back to the org file
 *
 * Given a position within a block's content, calculates the corresponding
 * position in the original org file.
 *
 * @param virtualModuleId - Virtual module ID of the block
 * @param position - Position in the block (0-based)
 * @param manifest - Block manifest
 * @returns Org file position, or null if block not found
 */
export function blockToOrg(
  virtualModuleId: string,
  position: Position,
  manifest: BlockManifest
): BlockToOrgResult | null {
  const block = manifest.blocksByVirtualId.get(virtualModuleId);
  if (!block) return null;

  // Map position from block to org file
  // Org line = (block line) + (start line) + 1
  // (add 1 because startLine is the #+begin_src line)
  const orgLine = position.line + block.startLine + 1;

  return {
    orgFilePath: block.orgFilePath,
    position: {
      line: orgLine - 1, // Convert back to 0-based
      character: position.character,
    },
    orgUri: `file://${manifest.projectRoot}/${block.orgFilePath}`,
  };
}

/**
 * Map a range from block coordinates to org file coordinates
 *
 * @param virtualModuleId - Virtual module ID of the block
 * @param range - Range in block coordinates (0-based)
 * @param manifest - Block manifest
 * @returns Range in org file coordinates, or null if block not found
 */
export function mapRangeToOrg(
  virtualModuleId: string,
  range: Range,
  manifest: BlockManifest
): Range | null {
  const startResult = blockToOrg(virtualModuleId, range.start, manifest);
  const endResult = blockToOrg(virtualModuleId, range.end, manifest);

  if (!startResult || !endResult) return null;

  return {
    start: startResult.position,
    end: endResult.position,
  };
}

/**
 * Map a range from org file coordinates to block coordinates
 *
 * @param orgFilePath - Org file path
 * @param range - Range in org file coordinates (0-based)
 * @param manifest - Block manifest
 * @returns Range in block coordinates with block info, or null if not in a block
 */
export function mapRangeToBlock(
  orgFilePath: string,
  range: Range,
  manifest: BlockManifest
): { range: Range; block: BlockInfo } | null {
  const startResult = orgToBlock(orgFilePath, range.start, manifest);
  const endResult = orgToBlock(orgFilePath, range.end, manifest);

  if (!startResult || !endResult) return null;

  // Ensure both ends are in the same block
  if (startResult.block.id !== endResult.block.id) {
    return null;
  }

  return {
    range: {
      start: startResult.position,
      end: endResult.position,
    },
    block: startResult.block,
  };
}

/**
 * Map a location from block to org file
 *
 * @param location - Location with virtual file URI and range
 * @param manifest - Block manifest
 * @returns Location in org file, or null if not found
 */
export function mapLocationToOrg(
  location: Location,
  manifest: BlockManifest
): Location | null {
  // Extract virtual module ID from URI
  // URI format: file://{projectRoot}/{virtualModuleId}
  const uri = location.uri;
  const projectRootPrefix = `file://${manifest.projectRoot}/`;

  let virtualModuleId: string;
  if (uri.startsWith(projectRootPrefix)) {
    virtualModuleId = uri.slice(projectRootPrefix.length);
  } else if (uri.startsWith("file://")) {
    // Try to find it by looking for virtual: prefix
    const pathPart = uri.slice(7); // Remove "file://"
    const virtualIndex = pathPart.indexOf("virtual:");
    if (virtualIndex !== -1) {
      virtualModuleId = pathPart.slice(virtualIndex);
    } else {
      return null;
    }
  } else {
    virtualModuleId = uri;
  }

  const block = manifest.blocksByVirtualId.get(virtualModuleId);
  if (!block) return null;

  const mappedRange = mapRangeToOrg(virtualModuleId, location.range, manifest);
  if (!mappedRange) return null;

  return {
    uri: `file://${manifest.projectRoot}/${block.orgFilePath}`,
    range: mappedRange,
  };
}

/**
 * Convert a character offset within block content to a Position
 *
 * @param content - Block content
 * @param offset - Character offset (0-based)
 * @returns Position (0-based line and character)
 */
export function offsetToPosition(content: string, offset: number): Position {
  const lines = content.slice(0, offset).split("\n");
  const line = lines.length - 1;
  const character = lines[lines.length - 1].length;

  return { line, character };
}

/**
 * Convert a Position to a character offset within block content
 *
 * @param content - Block content
 * @param position - Position (0-based)
 * @returns Character offset (0-based)
 */
export function positionToOffset(content: string, position: Position): number {
  const lines = content.split("\n");
  let offset = 0;

  for (let i = 0; i < position.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  offset += Math.min(position.character, lines[position.line]?.length || 0);

  return offset;
}

/**
 * Check if a position is inside a block's content area
 *
 * @param orgFilePath - Org file path
 * @param position - Position in org file (0-based)
 * @param manifest - Block manifest
 * @returns True if position is inside a code block
 */
export function isInsideBlock(
  orgFilePath: string,
  position: Position,
  manifest: BlockManifest
): boolean {
  return orgToBlock(orgFilePath, position, manifest) !== null;
}

/**
 * Get all blocks in an org file at a specific line
 *
 * @param orgFilePath - Org file path
 * @param line - Line number (0-based)
 * @param manifest - Block manifest
 * @returns Block at that line, or null
 */
export function getBlockAtLine(
  orgFilePath: string,
  line: number,
  manifest: BlockManifest
): BlockInfo | null {
  const result = orgToBlock(orgFilePath, { line, character: 0 }, manifest);
  return result?.block || null;
}
