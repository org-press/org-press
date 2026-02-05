/**
 * Tests for block-io utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  findBlock,
  readBlockContent,
  writeBlockContent,
  dangerousWriteContentBlock,
} from "./block-io.ts";

describe("Block I/O", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "block-io-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const sampleOrg = `#+TITLE: Test File

* Section 1

Some text here.

#+name: first-block
#+begin_src json
{
  "key": "value1"
}
#+end_src

* Section 2

#+name: second-block
#+begin_src javascript
console.log("hello");
#+end_src

#+begin_src css
.class { color: red; }
#+end_src
`;

  describe("findBlock", () => {
    it("should find block by name", () => {
      const location = findBlock(sampleOrg, "first-block");
      expect(location).not.toBeNull();
      expect(location!.name).toBe("first-block");
      expect(location!.language).toBe("json");
    });

    it("should find block by index", () => {
      const location = findBlock(sampleOrg, 0);
      expect(location).not.toBeNull();
      expect(location!.name).toBe("first-block");

      const location2 = findBlock(sampleOrg, 1);
      expect(location2).not.toBeNull();
      expect(location2!.name).toBe("second-block");

      const location3 = findBlock(sampleOrg, 2);
      expect(location3).not.toBeNull();
      expect(location3!.name).toBeUndefined(); // Unnamed block
      expect(location3!.language).toBe("css");
    });

    it("should return null for non-existent block", () => {
      const location = findBlock(sampleOrg, "non-existent");
      expect(location).toBeNull();

      const location2 = findBlock(sampleOrg, 99);
      expect(location2).toBeNull();
    });
  });

  describe("readBlockContent", () => {
    it("should read block content by name", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const content = readBlockContent({
        file: filePath,
        block: "first-block",
      });

      expect(content).toBe('{\n  "key": "value1"\n}');
    });

    it("should read block content by index", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const content = readBlockContent({
        file: filePath,
        block: 1,
      });

      expect(content).toBe('console.log("hello");');
    });

    it("should return null for non-existent file", () => {
      const content = readBlockContent({
        file: path.join(tempDir, "non-existent.org"),
        block: "first-block",
      });

      expect(content).toBeNull();
    });
  });

  describe("writeBlockContent", () => {
    it("should write new content to block by name", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const result = writeBlockContent({
        file: filePath,
        block: "first-block",
        content: '{\n  "key": "new-value"\n}',
      });

      expect(result.success).toBe(true);

      // Verify the content was written
      const newContent = readBlockContent({
        file: filePath,
        block: "first-block",
      });
      expect(newContent).toBe('{\n  "key": "new-value"\n}');

      // Verify other blocks are unchanged
      const secondBlock = readBlockContent({
        file: filePath,
        block: "second-block",
      });
      expect(secondBlock).toBe('console.log("hello");');
    });

    it("should write new content to block by index", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const result = writeBlockContent({
        file: filePath,
        block: 2,
        content: ".new-class { color: blue; }",
      });

      expect(result.success).toBe(true);

      const newContent = readBlockContent({
        file: filePath,
        block: 2,
      });
      expect(newContent).toBe(".new-class { color: blue; }");
    });

    it("should return error for non-existent block", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const result = writeBlockContent({
        file: filePath,
        block: "non-existent",
        content: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Block not found");
    });

    it("should return error for non-existent file", () => {
      const result = writeBlockContent({
        file: path.join(tempDir, "non-existent.org"),
        block: "first-block",
        content: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });

    it("should preserve #+NAME directive", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      writeBlockContent({
        file: filePath,
        block: "first-block",
        content: "new content",
      });

      const fileContent = fs.readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("#+name: first-block");
    });

    it("should preserve begin_src line", () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      writeBlockContent({
        file: filePath,
        block: "first-block",
        content: "new content",
      });

      const fileContent = fs.readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("#+begin_src json");
    });
  });

  describe("dangerousWriteContentBlock", () => {
    it("should be an async wrapper for writeBlockContent", async () => {
      const filePath = path.join(tempDir, "test.org");
      fs.writeFileSync(filePath, sampleOrg);

      const result = await dangerousWriteContentBlock({
        file: filePath,
        block: "first-block",
        content: '{"async": true}',
      });

      expect(result.success).toBe(true);

      const content = readBlockContent({
        file: filePath,
        block: "first-block",
      });
      expect(content).toBe('{"async": true}');
    });
  });
});
