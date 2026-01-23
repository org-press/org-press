/**
 * Tests for TypeScriptService
 *
 * Tests the service that bridges org files to TypeScript services,
 * handling block loading and position mapping.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TypeScriptService } from "./typescript-service.js";
import {
  createTestContext,
  createTestService,
  createOrgContent,
  writeTestFile,
  type TestContext,
} from "./__tests__/test-helpers.js";

describe("TypeScriptService", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe("Initialization", () => {
    it("should initialize with empty content directory", async () => {
      const service = new TypeScriptService({
        contentDir: ctx.contentDir,
        projectRoot: ctx.projectRoot,
      });

      await service.initialize();
      const manifest = service.getManifest();

      expect(manifest).toBeDefined();
      expect(manifest!.blocksByFile.size).toBe(0);
    });

    it("should load blocks from org files", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "hello", content: "const x = 1;" },
        ]),
      });

      const manifest = service.getManifest();
      expect(manifest).toBeDefined();
      expect(manifest!.blocksByFile.size).toBeGreaterThan(0);
    });

    it("should load multiple blocks from one file", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "block1", content: "const a = 1;" },
          { name: "block2", content: "const b = 2;" },
          { name: "block3", content: "const c = 3;" },
        ]),
      });

      const blocks = service.getBlocksForFile(`${ctx.projectRoot}/content/test.org`);
      expect(blocks.length).toBe(3);
    });

    it("should ignore non-TypeScript blocks", async () => {
      const orgContent = `#+TITLE: Test
#+name: python-block
#+begin_src python
print("hello")
#+end_src

#+name: ts-block
#+begin_src typescript
const x = 1;
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const env = service.getVirtualEnv();
      const files = env.getFileNames();

      // Should only have the TS block
      expect(files.some(f => f.includes("ts-block"))).toBe(true);
      expect(files.some(f => f.includes("python-block"))).toBe(false);
    });
  });

  describe("findBlockAtPosition", () => {
    it("should find block at cursor position", async () => {
      const orgContent = `#+TITLE: Test

#+name: my-block
#+begin_src typescript
const greeting = "Hello";
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position inside the block (line 4 is first line of content)
      const result = service.findBlockAtPosition(
        `${ctx.projectRoot}/content/test.org`,
        { line: 4, character: 6 }
      );

      expect(result).toBeDefined();
      expect(result!.block.name).toBe("my-block");
    });

    it("should return null for position outside blocks", async () => {
      const orgContent = `#+TITLE: Test

Some text here

#+name: my-block
#+begin_src typescript
const x = 1;
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position on "Some text here" line
      const result = service.findBlockAtPosition(
        `${ctx.projectRoot}/content/test.org`,
        { line: 2, character: 0 }
      );

      expect(result).toBeNull();
    });

    it("should return null for non-TS block position", async () => {
      const orgContent = `#+TITLE: Test

#+name: python-block
#+begin_src python
x = 1
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const result = service.findBlockAtPosition(
        `${ctx.projectRoot}/content/test.org`,
        { line: 4, character: 0 }
      );

      expect(result).toBeNull();
    });
  });

  describe("getCompletions", () => {
    it("should return completions for object properties", async () => {
      const orgContent = createOrgContent([
        {
          name: "test-block",
          content: `const obj = { foo: 1, bar: "hello" };
obj.`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position after "obj."
      const completions = service.getCompletions(
        `${ctx.projectRoot}/content/test.org`,
        { line: 5, character: 4 }
      );

      expect(completions).toBeDefined();
      expect(completions!.entries.some(e => e.name === "foo")).toBe(true);
      expect(completions!.entries.some(e => e.name === "bar")).toBe(true);
    });

    it("should return null for position outside blocks", async () => {
      const orgContent = `#+TITLE: Test

Some regular text

#+name: block
#+begin_src typescript
const x = 1;
#+end_src
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const completions = service.getCompletions(
        `${ctx.projectRoot}/content/test.org`,
        { line: 2, character: 0 }
      );

      expect(completions).toBeNull();
    });
  });

  describe("getQuickInfo", () => {
    it("should return type info for variables", async () => {
      const orgContent = createOrgContent([
        { name: "vars", content: `const count: number = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position at "count"
      const info = service.getQuickInfo(
        `${ctx.projectRoot}/content/test.org`,
        { line: 4, character: 6 }
      );

      expect(info).toBeDefined();
      expect(info!.displayParts).toBeDefined();
    });

    it("should return function signature info", async () => {
      const orgContent = createOrgContent([
        {
          name: "funcs",
          content: `function add(a: number, b: number): number {
  return a + b;
}`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position at "add" function name
      const info = service.getQuickInfo(
        `${ctx.projectRoot}/content/test.org`,
        { line: 4, character: 9 }
      );

      expect(info).toBeDefined();
    });
  });

  describe("getDefinitions", () => {
    it("should find definition in same block", async () => {
      const orgContent = createOrgContent([
        {
          name: "defs",
          content: `const value = 42;
const result = value + 10;`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position at second "value"
      const definitions = service.getDefinitions(
        `${ctx.projectRoot}/content/test.org`,
        { line: 5, character: 15 }
      );

      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0].orgFilePath).toContain("test.org");
    });
  });

  describe("getDiagnostics", () => {
    it("should report type errors with org positions", async () => {
      const orgContent = createOrgContent([
        { name: "errors", content: `const x: number = "wrong type";` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const diagnostics = service.getDiagnostics(
        `${ctx.projectRoot}/content/test.org`
      );

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].severity).toBe("error");
      expect(diagnostics[0].message).toContain("string");
    });

    it("should return empty for valid code", async () => {
      const orgContent = createOrgContent([
        { name: "valid", content: `const x: number = 42;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      const diagnostics = service.getDiagnostics(
        `${ctx.projectRoot}/content/test.org`
      );

      expect(diagnostics.length).toBe(0);
    });

    it("should return empty for file without TS blocks", async () => {
      const orgContent = `#+TITLE: Test

Just some text, no code blocks.
`;
      const service = await createTestService(ctx, { "test.org": orgContent });

      const diagnostics = service.getDiagnostics(
        `${ctx.projectRoot}/content/test.org`
      );

      expect(diagnostics).toEqual([]);
    });
  });

  describe("getReferences", () => {
    it("should find references within same block", async () => {
      const orgContent = createOrgContent([
        {
          name: "refs",
          content: `const x = 1;
const y = x;
const z = x + 1;`,
        },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Position at first "x"
      const references = service.getReferences(
        `${ctx.projectRoot}/content/test.org`,
        { line: 4, character: 6 }
      );

      expect(references.length).toBeGreaterThan(0);
    });
  });

  describe("updateOrgFile", () => {
    it("should update blocks when org file changes", async () => {
      const orgContent = createOrgContent([
        { name: "original", content: `const x = 1;` },
      ]);
      const service = await createTestService(ctx, { "test.org": orgContent });

      // Update the file on disk (updateOrgFile reads from disk)
      const updatedContent = createOrgContent([
        { name: "updated", content: `const y = 2;` },
      ]);
      writeTestFile(ctx.contentDir, "test.org", updatedContent);

      service.updateOrgFile(
        `${ctx.projectRoot}/content/test.org`,
        updatedContent
      );

      const env = service.getVirtualEnv();
      const files = env.getFileNames();

      expect(files.some(f => f.includes("updated"))).toBe(true);
      expect(files.some(f => f.includes("original"))).toBe(false);
    });
  });

  describe("removeOrgFile", () => {
    it("should remove blocks when org file is deleted", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "to-remove", content: `const x = 1;` },
        ]),
      });

      const env = service.getVirtualEnv();
      expect(env.getFileNames().length).toBeGreaterThan(0);

      service.removeOrgFile(`${ctx.projectRoot}/content/test.org`);

      expect(env.getFileNames().some(f => f.includes("to-remove"))).toBe(false);
    });
  });

  describe("Multiple File Support", () => {
    it("should handle multiple org files", async () => {
      const service = await createTestService(ctx, {
        "file1.org": createOrgContent([
          { name: "block1", content: "const a = 1;" },
        ]),
        "file2.org": createOrgContent([
          { name: "block2", content: "const b = 2;" },
        ]),
      });

      const env = service.getVirtualEnv();
      const files = env.getFileNames();

      expect(files.some(f => f.includes("file1") && f.includes("block1"))).toBe(true);
      expect(files.some(f => f.includes("file2") && f.includes("block2"))).toBe(true);
    });

    it("should handle nested directory structure", async () => {
      const service = await createTestService(ctx, {
        "pages/index.org": createOrgContent([
          { name: "index-block", content: "const index = 1;" },
        ]),
        "pages/about.org": createOrgContent([
          { name: "about-block", content: "const about = 2;" },
        ]),
        "components/button.org": createOrgContent([
          { name: "button-block", content: "const Button = () => {};" },
        ]),
      });

      const env = service.getVirtualEnv();
      const files = env.getFileNames();

      expect(files.some(f => f.includes("pages/index"))).toBe(true);
      expect(files.some(f => f.includes("pages/about"))).toBe(true);
      expect(files.some(f => f.includes("components/button"))).toBe(true);
    });
  });

  describe("Language Support", () => {
    it("should handle TypeScript blocks", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "ts", language: "typescript", content: "const x: number = 1;" },
        ]),
      });

      const env = service.getVirtualEnv();
      expect(env.getFileNames().some(f => f.endsWith(".ts"))).toBe(true);
    });

    it("should handle JavaScript blocks", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "js", language: "javascript", content: "const x = 1;" },
        ]),
      });

      const env = service.getVirtualEnv();
      expect(env.getFileNames().some(f => f.endsWith(".js"))).toBe(true);
    });

    it("should handle TSX blocks", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "tsx", language: "tsx", content: "const App = () => <div>Hello</div>;" },
        ]),
      });

      const env = service.getVirtualEnv();
      expect(env.getFileNames().some(f => f.endsWith(".tsx"))).toBe(true);
    });

    it("should handle JSX blocks", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "jsx", language: "jsx", content: "const App = () => <div>Hello</div>;" },
        ]),
      });

      const env = service.getVirtualEnv();
      expect(env.getFileNames().some(f => f.endsWith(".jsx"))).toBe(true);
    });
  });

  describe("getBlocksForFile", () => {
    it("should return all blocks for a file", async () => {
      const service = await createTestService(ctx, {
        "test.org": createOrgContent([
          { name: "block1", content: "const a = 1;" },
          { name: "block2", content: "const b = 2;" },
        ]),
      });

      const blocks = service.getBlocksForFile(`${ctx.projectRoot}/content/test.org`);
      expect(blocks.length).toBe(2);
      expect(blocks.map(b => b.name)).toContain("block1");
      expect(blocks.map(b => b.name)).toContain("block2");
    });

    it("should return empty array for non-existent file", async () => {
      const service = await createTestService(ctx, {});
      const blocks = service.getBlocksForFile(`${ctx.projectRoot}/content/nonexistent.org`);
      expect(blocks).toEqual([]);
    });
  });
});
