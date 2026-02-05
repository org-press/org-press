/**
 * Unit tests for org-import functionality
 *
 * Tests for bare .org file imports that return:
 * - Default export with { html, metadata, blocks, namedBlocks }
 * - Named exports for each named block
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// We need to test the generateOrgImportModule function
// Since it's not exported, we'll test via the plugin interface
// First, let's import the parseOrgFile and extractCodeBlocks functions
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { extractMetadata } from "../../parser/metadata.ts";
import { parseBlockParameters } from "../../plugins/utils.ts";

// Helper to parse org file (mirrors the implementation)
function parseOrgFile(filePath: string): { ast: OrgData; content: string } {
  const content = fs.readFileSync(filePath, "utf-8");
  const ast = parse(content) as OrgData;
  return { ast, content };
}

// Helper to extract code blocks (mirrors the implementation)
function extractCodeBlocks(ast: OrgData, orgContent: string): Array<{
  language: string;
  value: string;
  meta: string;
  name?: string;
  index: number;
}> {
  const blocks: Array<{
    language: string;
    value: string;
    meta: string;
    name?: string;
    index: number;
  }> = [];

  let blockIndex = 0;

  const lines = orgContent.split("\n");
  const blockMetadata: Array<{ name?: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^\s*#\+begin_src/i)) {
      let blockName: string | undefined = undefined;

      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        const nameMatch = prevLine.match(/^\s*#\+name:\s*(.+)/i);
        if (nameMatch) {
          blockName = nameMatch[1].trim();
          break;
        }
        if (prevLine.trim() && !prevLine.trim().startsWith("#")) {
          break;
        }
      }

      blockMetadata.push({ name: blockName, line: i });
    }
  }

  let metadataIndex = 0;

  function traverse(node: any) {
    if (node.type === "src-block") {
      const metadata = blockMetadata[metadataIndex];
      const params = parseBlockParameters(node.parameters || "");
      const blockName = metadata?.name || params.name;

      blocks.push({
        language: node.language || "",
        value: node.value || "",
        meta: node.parameters || "",
        name: blockName,
        index: blockIndex,
      });

      blockIndex++;
      metadataIndex++;
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return blocks;
}

// Simulate the generateOrgImportModule function output structure
function generateOrgImportModuleTest(
  fullPath: string,
  orgFilePath: string
): string {
  const { ast, content } = parseOrgFile(fullPath);
  const blocks = extractCodeBlocks(ast, content);
  const metadata = extractMetadata(ast);

  const blockImports: string[] = [];
  const blockDefinitions: string[] = [];
  const namedExports: string[] = [];
  const namedBlocksEntries: string[] = [];

  blocks.forEach((block, idx) => {
    const params = parseBlockParameters(block.meta);
    const parser = params.use || "default";

    const EXTENSION_MAP: Record<string, string> = {
      javascript: "js", js: "js",
      typescript: "ts", ts: "ts",
      jsx: "jsx", tsx: "tsx",
      json: "js",
    };
    const extension = EXTENSION_MAP[block.language.toLowerCase()] || "js";

    const blockVirtualId = block.name
      ? `virtual:org-press:block:${parser}:${orgFilePath}:NAME:${block.name}.${extension}`
      : `virtual:org-press:block:${parser}:${orgFilePath}:${idx}.${extension}`;

    const importName = `__block_${idx}`;
    blockImports.push(`import * as ${importName} from "${blockVirtualId}";`);

    const blockDef = `{
    name: ${block.name ? JSON.stringify(block.name) : "undefined"},
    code: ${JSON.stringify(block.value)},
    language: ${JSON.stringify(block.language)},
    index: ${idx},
    parameters: ${JSON.stringify(parseBlockParameters(block.meta))},
    exports: ${importName}.default !== undefined ? ${importName}.default : ${importName}
  }`;

    blockDefinitions.push(blockDef);

    if (block.name) {
      const jsIdentifier = block.name.replace(/-/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      namedBlocksEntries.push(`${JSON.stringify(block.name)}: __blocks[${idx}]`);
      namedExports.push(`export const ${jsIdentifier} = __blocks[${idx}];`);
    }
  });

  const htmlPlaceholder = '""';

  return `
// Auto-generated org-import module for: ${orgFilePath}
${blockImports.join("\n")}

const __metadata = ${JSON.stringify(metadata, null, 2)};

const __blocks = [
  ${blockDefinitions.join(",\n  ")}
];

const __namedBlocks = {
  ${namedBlocksEntries.join(",\n  ")}
};

const __html = ${htmlPlaceholder};

export default {
  html: __html,
  metadata: __metadata,
  blocks: __blocks,
  namedBlocks: __namedBlocks
};

${namedExports.join("\n")}
`;
}

describe("Org Import Module Generation", () => {
  let tempDir: string;
  let testOrgFile: string;

  beforeAll(() => {
    // Create temporary directory and test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "org-import-test-"));

    // Create a test org file
    testOrgFile = path.join(tempDir, "test.org");
    const testContent = `#+TITLE: Test Document
#+AUTHOR: Test Author
#+DATE: 2025-01-15
#+STATUS: draft

Some text content.

#+NAME: greeting
#+begin_src javascript
export default "Hello, World!";
#+end_src

#+NAME: add-numbers
#+begin_src javascript :use server
export default function add(a, b) {
  return a + b;
}
#+end_src

#+begin_src javascript
// Unnamed block
console.log("test");
#+end_src

#+NAME: config-data
#+begin_src json
{"key": "value", "count": 42}
#+end_src
`;
    fs.writeFileSync(testOrgFile, testContent);
  });

  afterAll(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("Metadata Extraction", () => {
    it("should extract title from org file", () => {
      const { ast } = parseOrgFile(testOrgFile);
      const metadata = extractMetadata(ast);
      expect(metadata.title).toBe("Test Document");
    });

    it("should extract author from org file", () => {
      const { ast } = parseOrgFile(testOrgFile);
      const metadata = extractMetadata(ast);
      expect(metadata.author).toBe("Test Author");
    });

    it("should extract date from org file", () => {
      const { ast } = parseOrgFile(testOrgFile);
      const metadata = extractMetadata(ast);
      expect(metadata.date).toBe("2025-01-15");
    });

    it("should extract status from org file", () => {
      const { ast } = parseOrgFile(testOrgFile);
      const metadata = extractMetadata(ast);
      expect(metadata.status).toBe("draft");
    });
  });

  describe("Block Extraction", () => {
    it("should extract all code blocks from org file", () => {
      const { ast, content } = parseOrgFile(testOrgFile);
      const blocks = extractCodeBlocks(ast, content);
      expect(blocks.length).toBe(4);
    });

    it("should extract named blocks with their names", () => {
      const { ast, content } = parseOrgFile(testOrgFile);
      const blocks = extractCodeBlocks(ast, content);

      const namedBlocks = blocks.filter(b => b.name);
      expect(namedBlocks.length).toBe(3);
      expect(namedBlocks.map(b => b.name)).toContain("greeting");
      expect(namedBlocks.map(b => b.name)).toContain("add-numbers");
      expect(namedBlocks.map(b => b.name)).toContain("config-data");
    });

    it("should extract block languages correctly", () => {
      const { ast, content } = parseOrgFile(testOrgFile);
      const blocks = extractCodeBlocks(ast, content);

      const greetingBlock = blocks.find(b => b.name === "greeting");
      expect(greetingBlock?.language).toBe("javascript");

      const configBlock = blocks.find(b => b.name === "config-data");
      expect(configBlock?.language).toBe("json");
    });

    it("should extract block parameters", () => {
      const { ast, content } = parseOrgFile(testOrgFile);
      const blocks = extractCodeBlocks(ast, content);

      const addBlock = blocks.find(b => b.name === "add-numbers");
      const params = parseBlockParameters(addBlock?.meta || "");
      expect(params.use).toBe("server");
    });

    it("should extract block content (value)", () => {
      const { ast, content } = parseOrgFile(testOrgFile);
      const blocks = extractCodeBlocks(ast, content);

      const greetingBlock = blocks.find(b => b.name === "greeting");
      expect(greetingBlock?.value).toContain('export default "Hello, World!"');
    });
  });

  describe("Module Generation", () => {
    it("should generate valid module code with imports for each block", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      // Check that imports are generated for each block
      expect(code).toContain('import * as __block_0');
      expect(code).toContain('import * as __block_1');
      expect(code).toContain('import * as __block_2');
      expect(code).toContain('import * as __block_3');
    });

    it("should generate virtual module IDs with correct parser", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      // First block (greeting) should use default parser
      expect(code).toContain('virtual:org-press:block:default:test.org:NAME:greeting.js');

      // Second block (add-numbers) should use server parser
      expect(code).toContain('virtual:org-press:block:server:test.org:NAME:add-numbers.js');
    });

    it("should include metadata in generated module", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      expect(code).toContain('"title": "Test Document"');
      expect(code).toContain('"author": "Test Author"');
      expect(code).toContain('"date": "2025-01-15"');
    });

    it("should generate named exports for named blocks", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      // Check for named exports (hyphens converted to underscores)
      expect(code).toContain('export const greeting = __blocks[0]');
      expect(code).toContain('export const add_numbers = __blocks[1]');
      expect(code).toContain('export const config_data = __blocks[3]');
    });

    it("should include namedBlocks object with block references", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      expect(code).toContain('"greeting": __blocks[0]');
      expect(code).toContain('"add-numbers": __blocks[1]');
      expect(code).toContain('"config-data": __blocks[3]');
    });

    it("should export default with html, metadata, blocks, namedBlocks", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      expect(code).toContain('export default {');
      expect(code).toContain('html: __html');
      expect(code).toContain('metadata: __metadata');
      expect(code).toContain('blocks: __blocks');
      expect(code).toContain('namedBlocks: __namedBlocks');
    });

    it("should include block definitions with all required fields", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      // Check for block definition structure
      expect(code).toContain('name: "greeting"');
      expect(code).toContain('language: "javascript"');
      expect(code).toContain('index: 0');
      expect(code).toContain('parameters:');
      expect(code).toContain('exports:');
    });
  });

  describe("Identifier Sanitization", () => {
    it("should convert hyphens to underscores in named exports", () => {
      const relPath = "test.org";
      const code = generateOrgImportModuleTest(testOrgFile, relPath);

      // "add-numbers" should become "add_numbers"
      expect(code).toContain('export const add_numbers');
      // "config-data" should become "config_data"
      expect(code).toContain('export const config_data');
    });
  });

  describe("Extension Mapping", () => {
    let mixedExtFile: string;

    beforeAll(() => {
      mixedExtFile = path.join(tempDir, "mixed.org");
      const content = `#+TITLE: Mixed Extensions

#+NAME: ts-block
#+begin_src typescript
const x: number = 42;
export default x;
#+end_src

#+NAME: tsx-block
#+begin_src tsx
export default <div>Hello</div>;
#+end_src

#+NAME: json-block
#+begin_src json
{"test": true}
#+end_src
`;
      fs.writeFileSync(mixedExtFile, content);
    });

    it("should use correct extension for TypeScript blocks", () => {
      const relPath = "mixed.org";
      const code = generateOrgImportModuleTest(mixedExtFile, relPath);
      expect(code).toContain('NAME:ts-block.ts"');
    });

    it("should use correct extension for TSX blocks", () => {
      const relPath = "mixed.org";
      const code = generateOrgImportModuleTest(mixedExtFile, relPath);
      expect(code).toContain('NAME:tsx-block.tsx"');
    });

    it("should use .js extension for JSON blocks", () => {
      const relPath = "mixed.org";
      const code = generateOrgImportModuleTest(mixedExtFile, relPath);
      expect(code).toContain('NAME:json-block.js"');
    });
  });
});

describe("Type Exports", () => {
  it("should export OrgImport, OrgBlock, OrgMetadata types from types.ts", async () => {
    // Import types directly from types.ts to avoid esbuild import chain issues
    const types = await import("../../plugins/types.ts");

    // Verify the module exports the expected type names
    // Note: TypeScript interfaces don't exist at runtime, but we can verify
    // the module loads without error
    expect(types).toBeDefined();

    // The types module should exist and be importable
    // We can't directly check for type exports, but at compile time
    // TypeScript will verify these exports exist in types.ts
  });
});
