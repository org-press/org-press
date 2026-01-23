/**
 * Tests for Format Command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  formatOrgFiles,
  collectBlocks,
  type FormatOptions,
  type CollectedBlock,
} from "./fmt.ts";

describe("Format Command", () => {
  let tempDir: string;
  let contentDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fmt-test-"));
    contentDir = path.join(tempDir, "content");
    fs.mkdirSync(contentDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("collectBlocks", () => {
    it("should find code blocks in org files", () => {
      const orgContent = `#+TITLE: Test

#+NAME: my-function
#+begin_src typescript
function hello() {
  return "world";
}
#+end_src

#+begin_src javascript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const blocks = collectBlocks(contentDir, tempDir);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockName).toBe("my-function");
      expect(blocks[0].language).toBe("typescript");
      expect(blocks[0].content).toContain("function hello()");
      expect(blocks[1].language).toBe("javascript");
    });

    it("should handle nested directories", () => {
      const subDir = path.join(contentDir, "posts");
      fs.mkdirSync(subDir, { recursive: true });

      fs.writeFileSync(
        path.join(subDir, "post.org"),
        `#+begin_src typescript
const x = 1;
#+end_src
`
      );

      const blocks = collectBlocks(contentDir, tempDir);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].relativePath).toContain("posts");
    });

    it("should filter by language", () => {
      const orgContent = `#+begin_src typescript
const x = 1;
#+end_src

#+begin_src javascript
const y = 2;
#+end_src

#+begin_src css
.foo { color: red; }
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const blocks = collectBlocks(contentDir, tempDir, {
        languages: ["typescript"],
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe("typescript");
    });

    it("should filter by file", () => {
      fs.writeFileSync(
        path.join(contentDir, "a.org"),
        `#+begin_src typescript
const a = 1;
#+end_src
`
      );
      fs.writeFileSync(
        path.join(contentDir, "b.org"),
        `#+begin_src typescript
const b = 2;
#+end_src
`
      );

      const blocks = collectBlocks(contentDir, tempDir, {
        files: ["content/a.org"],
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain("const a");
    });

    it("should handle malformed blocks gracefully", () => {
      // Block without end_src at all
      const orgContent = `#+begin_src typescript
// This block has no end_src tag
const x = 1;
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const blocks = collectBlocks(contentDir, tempDir);

      // Should skip malformed block
      expect(blocks).toHaveLength(0);
    });

    it("should record correct line numbers", () => {
      const orgContent = `#+TITLE: Test

Some text here.

#+begin_src typescript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const blocks = collectBlocks(contentDir, tempDir);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].startLine).toBe(5); // 1-based line of #+begin_src
    });

    it("should return empty array for missing directory", () => {
      const blocks = collectBlocks("/nonexistent", tempDir);
      expect(blocks).toHaveLength(0);
    });
  });

  describe("formatOrgFiles", () => {
    it("should format unformatted code blocks", async () => {
      const orgContent = `#+begin_src typescript
function hello(){return "world"}
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.changed).toBe(1);
      expect(summary.errors).toBe(0);

      // Verify the file was updated
      const updatedContent = fs.readFileSync(
        path.join(contentDir, "test.org"),
        "utf-8"
      );
      expect(updatedContent).toContain('return "world";');
    });

    it("should not modify already formatted code", async () => {
      const orgContent = `#+begin_src typescript
function hello() {
  return "world";
}
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.changed).toBe(0);
      expect(summary.unchanged).toBe(1);
    });

    it("should respect --check mode", async () => {
      const orgContent = `#+begin_src typescript
function hello(){return "world"}
#+end_src
`;
      const orgPath = path.join(contentDir, "test.org");
      fs.writeFileSync(orgPath, orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
        check: true,
      });

      expect(summary.changed).toBe(1);

      // Verify file was NOT modified
      const unchangedContent = fs.readFileSync(orgPath, "utf-8");
      expect(unchangedContent).toBe(orgContent);
    });

    it("should skip unsupported languages", async () => {
      const orgContent = `#+begin_src rust
fn main() {}
#+end_src

#+begin_src typescript
const x=1
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(2);
      expect(summary.skipped).toBe(1); // rust
      expect(summary.changed).toBe(1); // typescript
    });

    it("should filter by language", async () => {
      const orgContent = `#+begin_src typescript
const x=1
#+end_src

#+begin_src javascript
const y=2
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
        languages: ["typescript"],
      });

      expect(summary.total).toBe(1);
      expect(summary.changed).toBe(1);

      // Verify only typescript was formatted
      const content = fs.readFileSync(
        path.join(contentDir, "test.org"),
        "utf-8"
      );
      expect(content).toContain("const x = 1;"); // formatted
      expect(content).toContain("const y=2"); // not formatted
    });

    it("should handle syntax errors gracefully", async () => {
      const orgContent = `#+begin_src typescript
const x = {{{ invalid syntax
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.results[0].error).toBeDefined();
    });

    it("should format JSON blocks", async () => {
      const orgContent = `#+begin_src json
{"foo":"bar","baz":123}
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.changed).toBe(1);

      const content = fs.readFileSync(
        path.join(contentDir, "test.org"),
        "utf-8"
      );
      expect(content).toContain('"foo": "bar"');
    });

    it("should format CSS blocks", async () => {
      const orgContent = `#+begin_src css
.foo{color:red;margin:10px}
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.changed).toBe(1);

      const content = fs.readFileSync(
        path.join(contentDir, "test.org"),
        "utf-8"
      );
      expect(content).toContain("color: red;");
    });

    it("should return correct summary for empty content", async () => {
      const summary = await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(0);
      expect(summary.changed).toBe(0);
      expect(summary.errors).toBe(0);
      expect(summary.results).toHaveLength(0);
    });

    it("should preserve surrounding org content", async () => {
      const orgContent = `#+TITLE: My Document

Some introductory text here.

#+NAME: my-code
#+begin_src typescript
const x=1
#+end_src

More text after the code block.
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      await formatOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      const content = fs.readFileSync(
        path.join(contentDir, "test.org"),
        "utf-8"
      );
      expect(content).toContain("#+TITLE: My Document");
      expect(content).toContain("Some introductory text here.");
      expect(content).toContain("#+NAME: my-code");
      expect(content).toContain("More text after the code block.");
      expect(content).toContain("const x = 1;"); // formatted
    });
  });
});
