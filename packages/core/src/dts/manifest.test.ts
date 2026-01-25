/**
 * Tests for Block Manifest Generator
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractBlocksFromFile, generateBlockManifest, filterTsJsBlocks, isTsJsLanguage } from "./manifest.ts";

// Create a temp directory for test files
const testDir = path.join(process.cwd(), ".test-dts-manifest");

describe("Block Manifest Generator", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("extractBlocksFromFile", () => {
    it("extracts basic JavaScript block", () => {
      const orgContent = `#+TITLE: Test

#+begin_src javascript
const x = 1;
export default x;
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe("javascript");
      expect(blocks[0].startLine).toBe(3);
      expect(blocks[0].endLine).toBe(6);
      // Block content may include trailing newline depending on parser
      expect(blocks[0].content.trim()).toBe("const x = 1;\nexport default x;");
      expect(blocks[0].index).toBe(0);
    });

    it("extracts named block with #+NAME: directive", () => {
      const orgContent = `#+TITLE: Test

#+NAME: my-block
#+begin_src typescript
export function hello(): string {
  return "world";
}
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].name).toBe("my-block");
      expect(blocks[0].language).toBe("typescript");
      expect(blocks[0].virtualModuleId).toContain("NAME:my-block");
    });

    it("extracts multiple blocks with correct indices", () => {
      const orgContent = `#+TITLE: Test

#+begin_src javascript
const a = 1;
#+end_src

Some text here.

#+begin_src typescript
const b = 2;
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].index).toBe(0);
      expect(blocks[0].language).toBe("javascript");
      expect(blocks[1].index).toBe(1);
      expect(blocks[1].language).toBe("typescript");
    });

    it("extracts block parameters", () => {
      const orgContent = `#+TITLE: Test

#+begin_src javascript :use jscad
const shape = cube();
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].parameters.use).toBe("jscad");
      expect(blocks[0].virtualModuleId).toContain("jscad");
    });

    it("handles non-JS blocks", () => {
      const orgContent = `#+TITLE: Test

#+begin_src python
def hello():
    return "world"
#+end_src

#+begin_src javascript
const x = 1;
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe("python");
      expect(blocks[1].language).toBe("javascript");
    });

    it("creates correct virtual module IDs", () => {
      const orgContent = `#+TITLE: Test

#+begin_src typescript
const x = 1;
#+end_src

#+NAME: named
#+begin_src javascript
const y = 2;
#+end_src
`;
      const orgFile = path.join(testDir, "test.org");
      fs.writeFileSync(orgFile, orgContent);

      const blocks = extractBlocksFromFile(orgFile, testDir);

      expect(blocks[0].virtualModuleId).toMatch(
        /^virtual:org-press:block:default:.*test\.org:0\.ts$/
      );
      expect(blocks[1].virtualModuleId).toMatch(
        /^virtual:org-press:block:default:.*test\.org:NAME:named\.js$/
      );
    });
  });

  describe("generateBlockManifest", () => {
    it("generates manifest from directory", async () => {
      const orgContent = `#+TITLE: Test
#+begin_src javascript
const x = 1;
#+end_src
`;
      const subDir = path.join(testDir, "content");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "test.org"), orgContent);

      const manifest = await generateBlockManifest(subDir, testDir);

      expect(manifest.version).toBe(1);
      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.projectRoot).toBe(testDir);
      expect(manifest.blocksByFile.size).toBe(1);
      expect(manifest.blocksByVirtualId.size).toBe(1);
    });

    it("handles nested directories", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
#+end_src
`;
      const nestedDir = path.join(testDir, "content", "nested", "deep");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, "test.org"), orgContent);

      const manifest = await generateBlockManifest(
        path.join(testDir, "content"),
        testDir
      );

      expect(manifest.blocksByFile.size).toBe(1);
      const keys = Array.from(manifest.blocksByFile.keys());
      expect(keys[0]).toContain("nested/deep/test.org");
    });

    it("skips hidden directories and node_modules", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
#+end_src
`;
      const contentDir = path.join(testDir, "content");
      const hiddenDir = path.join(contentDir, ".hidden");
      const nodeModulesDir = path.join(contentDir, "node_modules");

      fs.mkdirSync(contentDir, { recursive: true });
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.mkdirSync(nodeModulesDir, { recursive: true });

      fs.writeFileSync(path.join(contentDir, "visible.org"), orgContent);
      fs.writeFileSync(path.join(hiddenDir, "hidden.org"), orgContent);
      fs.writeFileSync(path.join(nodeModulesDir, "nm.org"), orgContent);

      const manifest = await generateBlockManifest(contentDir, testDir);

      expect(manifest.blocksByFile.size).toBe(1);
      const keys = Array.from(manifest.blocksByFile.keys());
      expect(keys[0]).toContain("visible.org");
    });
  });

  describe("filterTsJsBlocks", () => {
    it("filters to only TypeScript/JavaScript blocks", async () => {
      const orgContent = `#+TITLE: Test

#+begin_src python
print("hello")
#+end_src

#+begin_src javascript
const x = 1;
#+end_src

#+begin_src typescript
const y: number = 2;
#+end_src

#+begin_src shell
echo "hello"
#+end_src
`;
      const contentDir = path.join(testDir, "content");
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const fullManifest = await generateBlockManifest(contentDir, testDir);
      const filtered = filterTsJsBlocks(fullManifest);

      expect(fullManifest.blocksByFile.get("content/test.org")?.length).toBe(4);
      expect(filtered.blocksByFile.get("content/test.org")?.length).toBe(2);

      const filteredBlocks = filtered.blocksByFile.get("content/test.org")!;
      expect(filteredBlocks.every((b) => ["javascript", "typescript"].includes(b.language))).toBe(true);
    });
  });

  describe("isTsJsLanguage", () => {
    it("returns true for TypeScript languages", () => {
      expect(isTsJsLanguage("typescript")).toBe(true);
      expect(isTsJsLanguage("ts")).toBe(true);
      expect(isTsJsLanguage("tsx")).toBe(true);
    });

    it("returns true for JavaScript languages", () => {
      expect(isTsJsLanguage("javascript")).toBe(true);
      expect(isTsJsLanguage("js")).toBe(true);
      expect(isTsJsLanguage("jsx")).toBe(true);
    });

    it("returns false for other languages", () => {
      expect(isTsJsLanguage("python")).toBe(false);
      expect(isTsJsLanguage("rust")).toBe(false);
      expect(isTsJsLanguage("shell")).toBe(false);
      expect(isTsJsLanguage("css")).toBe(false);
    });

    it("is case insensitive", () => {
      expect(isTsJsLanguage("TypeScript")).toBe(true);
      expect(isTsJsLanguage("JAVASCRIPT")).toBe(true);
    });
  });
});
