/**
 * Tests for Position Mapping Utilities
 */

import { describe, it, expect } from "vitest";
import {
  orgToBlock,
  blockToOrg,
  mapRangeToOrg,
  mapRangeToBlock,
  offsetToPosition,
  positionToOffset,
  isInsideBlock,
  getBlockAtLine,
} from "./position-mapping.ts";
import type { BlockManifest, BlockInfo } from "./types.ts";

// Create a test manifest
function createTestManifest(): BlockManifest {
  const blocks: BlockInfo[] = [
    {
      id: "test.org:0",
      orgFilePath: "test.org",
      name: "first-block",
      index: 0,
      language: "typescript",
      startLine: 5,  // #+begin_src line
      endLine: 10,   // #+end_src line
      startColumn: 1,
      parameters: {},
      virtualModuleId: "virtual:org-press:block:default:test.org:NAME:first-block.ts",
      content: "const x = 1;\nexport default x;",
    },
    {
      id: "test.org:1",
      orgFilePath: "test.org",
      name: undefined,
      index: 1,
      language: "javascript",
      startLine: 15,
      endLine: 20,
      startColumn: 1,
      parameters: {},
      virtualModuleId: "virtual:org-press:block:default:test.org:1.js",
      content: "function hello() {\n  return 'world';\n}",
    },
  ];

  const blocksByFile = new Map<string, BlockInfo[]>();
  blocksByFile.set("test.org", blocks);

  const blocksByVirtualId = new Map<string, BlockInfo>();
  for (const block of blocks) {
    blocksByVirtualId.set(block.virtualModuleId, block);
  }

  return {
    version: 1,
    generatedAt: Date.now(),
    projectRoot: "/project",
    blocksByFile,
    blocksByVirtualId,
  };
}

describe("Position Mapping Utilities", () => {
  describe("orgToBlock", () => {
    it("maps position inside first block", () => {
      const manifest = createTestManifest();
      // Line 6 is the first line of block content (startLine is 5 for #+begin_src)
      // 0-based line 5 = 1-based line 6
      const result = orgToBlock("test.org", { line: 5, character: 5 }, manifest);

      expect(result).not.toBeNull();
      expect(result!.block.name).toBe("first-block");
      expect(result!.position.line).toBe(0); // First line of block content
      expect(result!.position.character).toBe(5);
    });

    it("maps position inside second block", () => {
      const manifest = createTestManifest();
      // Line 16 (0-based 15) is first content line of second block
      const result = orgToBlock("test.org", { line: 15, character: 2 }, manifest);

      expect(result).not.toBeNull();
      expect(result!.block.index).toBe(1);
      expect(result!.position.line).toBe(0);
    });

    it("returns null for position outside any block", () => {
      const manifest = createTestManifest();
      // Line 12 is between blocks
      const result = orgToBlock("test.org", { line: 11, character: 0 }, manifest);

      expect(result).toBeNull();
    });

    it("returns null for position on #+begin_src line", () => {
      const manifest = createTestManifest();
      // Line 5 (0-based 4) is the #+begin_src line
      const result = orgToBlock("test.org", { line: 4, character: 0 }, manifest);

      expect(result).toBeNull();
    });

    it("returns null for position on #+end_src line", () => {
      const manifest = createTestManifest();
      // Line 10 (0-based 9) is the #+end_src line
      const result = orgToBlock("test.org", { line: 9, character: 0 }, manifest);

      expect(result).toBeNull();
    });

    it("returns null for unknown file", () => {
      const manifest = createTestManifest();
      const result = orgToBlock("unknown.org", { line: 5, character: 0 }, manifest);

      expect(result).toBeNull();
    });
  });

  describe("blockToOrg", () => {
    it("maps position from block to org file", () => {
      const manifest = createTestManifest();
      const virtualId = "virtual:org-press:block:default:test.org:NAME:first-block.ts";

      const result = blockToOrg(virtualId, { line: 0, character: 5 }, manifest);

      expect(result).not.toBeNull();
      expect(result!.orgFilePath).toBe("test.org");
      // Block starts at line 5, content at line 6 (1-based)
      // So position in block line 0 = org line 5 (0-based)
      expect(result!.position.line).toBe(5);
      expect(result!.position.character).toBe(5);
    });

    it("maps second line of block correctly", () => {
      const manifest = createTestManifest();
      const virtualId = "virtual:org-press:block:default:test.org:1.js";

      const result = blockToOrg(virtualId, { line: 1, character: 2 }, manifest);

      expect(result).not.toBeNull();
      // Block starts at line 15, content at line 16
      // Line 1 in block = line 16 (0-based) in org
      expect(result!.position.line).toBe(16);
    });

    it("returns null for unknown virtual module", () => {
      const manifest = createTestManifest();
      const result = blockToOrg("unknown-module", { line: 0, character: 0 }, manifest);

      expect(result).toBeNull();
    });
  });

  describe("mapRangeToOrg", () => {
    it("maps a range from block to org", () => {
      const manifest = createTestManifest();
      const virtualId = "virtual:org-press:block:default:test.org:NAME:first-block.ts";

      const result = mapRangeToOrg(
        virtualId,
        {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 10 },
        },
        manifest
      );

      expect(result).not.toBeNull();
      expect(result!.start.line).toBe(5);
      expect(result!.end.line).toBe(6);
    });
  });

  describe("mapRangeToBlock", () => {
    it("maps a range from org to block", () => {
      const manifest = createTestManifest();

      const result = mapRangeToBlock(
        "test.org",
        {
          start: { line: 5, character: 0 },
          end: { line: 6, character: 5 },
        },
        manifest
      );

      expect(result).not.toBeNull();
      expect(result!.range.start.line).toBe(0);
      expect(result!.range.end.line).toBe(1);
      expect(result!.block.name).toBe("first-block");
    });

    it("returns null if range spans multiple blocks", () => {
      const manifest = createTestManifest();

      // Range from first block to second block
      const result = mapRangeToBlock(
        "test.org",
        {
          start: { line: 5, character: 0 },
          end: { line: 15, character: 5 },
        },
        manifest
      );

      expect(result).toBeNull();
    });
  });

  describe("offsetToPosition", () => {
    it("converts offset to position in single-line content", () => {
      const content = "const x = 1;";
      const position = offsetToPosition(content, 6);

      expect(position.line).toBe(0);
      expect(position.character).toBe(6);
    });

    it("converts offset to position in multi-line content", () => {
      const content = "line one\nline two\nline three";
      // Offset 10 is 'l' in "line two"
      const position = offsetToPosition(content, 9);

      expect(position.line).toBe(1);
      expect(position.character).toBe(0);
    });

    it("handles offset at end of line", () => {
      const content = "abc\ndef";
      // Offset 3 is end of first line (before newline)
      const position = offsetToPosition(content, 3);

      expect(position.line).toBe(0);
      expect(position.character).toBe(3);
    });
  });

  describe("positionToOffset", () => {
    it("converts position to offset in single-line content", () => {
      const content = "const x = 1;";
      const offset = positionToOffset(content, { line: 0, character: 6 });

      expect(offset).toBe(6);
    });

    it("converts position to offset in multi-line content", () => {
      const content = "line one\nline two\nline three";
      // Position (1, 5) should be the space after "line" in "line two"
      const offset = positionToOffset(content, { line: 1, character: 5 });

      expect(offset).toBe(14); // 9 (first line + newline) + 5
    });

    it("handles position beyond line length", () => {
      const content = "abc\ndef";
      // Character 10 on line 0 should clamp to line length (3)
      const offset = positionToOffset(content, { line: 0, character: 10 });

      expect(offset).toBe(3);
    });
  });

  describe("isInsideBlock", () => {
    it("returns true for position inside a block", () => {
      const manifest = createTestManifest();
      expect(isInsideBlock("test.org", { line: 5, character: 0 }, manifest)).toBe(true);
    });

    it("returns false for position outside blocks", () => {
      const manifest = createTestManifest();
      expect(isInsideBlock("test.org", { line: 11, character: 0 }, manifest)).toBe(false);
    });
  });

  describe("getBlockAtLine", () => {
    it("returns block at the given line", () => {
      const manifest = createTestManifest();
      const block = getBlockAtLine("test.org", 5, manifest);

      expect(block).not.toBeNull();
      expect(block!.name).toBe("first-block");
    });

    it("returns null for line outside blocks", () => {
      const manifest = createTestManifest();
      const block = getBlockAtLine("test.org", 11, manifest);

      expect(block).toBeNull();
    });
  });
});
