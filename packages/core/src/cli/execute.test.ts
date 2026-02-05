import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeOrgFile } from "./execute.ts";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Org File Execution", () => {
  const testDir = join(process.cwd(), "test-fixtures-cli");

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createTestFile(name: string, content: string): string {
    const filePath = join(testDir, name);
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  describe("executeOrgFile", () => {
    it("should execute a simple :exec block", async () => {
      const file = createTestFile(
        "simple.org",
        `#+TITLE: Test Script

#+begin_src javascript :exec
return 42
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe(42);
      expect(result.errors).toHaveLength(0);
    });

    it("should execute multiple blocks in order", async () => {
      const file = createTestFile(
        "multi.org",
        `#+TITLE: Multi Block Test

#+NAME: first
#+begin_src javascript :exec
context.value = 10;
return "first";
#+end_src

#+NAME: second
#+begin_src javascript :exec
return context.first + " then second";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0].value).toBe("first");
      expect(result.outputs[0].blockName).toBe("first");
      expect(result.outputs[1].value).toBe("first then second");
    });

    it("should share context between blocks", async () => {
      const file = createTestFile(
        "context.org",
        `#+TITLE: Context Test

#+NAME: setup
#+begin_src javascript :exec
context.counter = 1;
return context.counter;
#+end_src

#+NAME: increment
#+begin_src javascript :exec
context.counter++;
return context.counter;
#+end_src

#+NAME: final
#+begin_src javascript :exec
return context.counter * 10;
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(3);
      expect(result.outputs[0].value).toBe(1);
      expect(result.outputs[1].value).toBe(2);
      expect(result.outputs[2].value).toBe(20);
    });

    it("should execute only named block when --block is specified", async () => {
      const file = createTestFile(
        "named.org",
        `#+TITLE: Named Block Test

#+NAME: first
#+begin_src javascript :exec
return "first block";
#+end_src

#+NAME: target
#+begin_src javascript :exec
return "target block";
#+end_src

#+NAME: last
#+begin_src javascript :exec
return "last block";
#+end_src
`
      );

      const result = await executeOrgFile({ file, blockName: "target" });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("target block");
      expect(result.outputs[0].blockName).toBe("target");
    });

    it("should handle stdin input", async () => {
      const file = createTestFile(
        "stdin.org",
        `#+TITLE: Stdin Test

#+begin_src javascript :exec
const data = JSON.parse(input);
return data.name;
#+end_src
`
      );

      const result = await executeOrgFile({
        file,
        input: '{"name": "test-value"}',
      });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("test-value");
    });

    it("should capture execution errors", async () => {
      const file = createTestFile(
        "error.org",
        `#+TITLE: Error Test

#+begin_src javascript :exec
throw new Error("Intentional error");
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Intentional error");
    });

    it("should handle :use server blocks", async () => {
      const file = createTestFile(
        "use-server.org",
        `#+TITLE: Use Server Test

#+begin_src javascript :use server
return "executed via use server";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("executed via use server");
    });

    it("should skip non-executable blocks by default", async () => {
      const file = createTestFile(
        "skip.org",
        `#+TITLE: Skip Test

#+begin_src javascript
// This should be skipped (no :exec)
return "should not run";
#+end_src

#+begin_src javascript :exec
return "should run";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("should run");
    });

    it("should execute all blocks when --all is set", async () => {
      const file = createTestFile(
        "all.org",
        `#+TITLE: All Test

#+begin_src javascript
return "first";
#+end_src

#+begin_src javascript
return "second";
#+end_src
`
      );

      const result = await executeOrgFile({ file, all: true });

      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0].value).toBe("first");
      expect(result.outputs[1].value).toBe("second");
    });

    it("should strip shebang line", async () => {
      const file = createTestFile(
        "shebang.org",
        `#!/usr/bin/env orgp
#+TITLE: Shebang Test

#+begin_src javascript :exec
return "executed";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("executed");
    });

    it("should extract metadata", async () => {
      const file = createTestFile(
        "metadata.org",
        `#+TITLE: My Script
#+AUTHOR: Test Author
#+DATE: 2026-01-15

#+begin_src javascript :exec
return "done";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.metadata.title).toBe("My Script");
      expect(result.metadata.author).toBe("Test Author");
      expect(result.metadata.date).toBe("2026-01-15");
    });

    it("should handle async code", async () => {
      const file = createTestFile(
        "async.org",
        `#+TITLE: Async Test

#+begin_src javascript :exec
const delay = (ms) => new Promise(r => setTimeout(r, ms));
await delay(10);
return "async complete";
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("async complete");
    });

    it("should throw for non-existent file", async () => {
      await expect(
        executeOrgFile({ file: "non-existent.org" })
      ).rejects.toThrow("File not found");
    });

    it("should skip non-JavaScript blocks", async () => {
      const file = createTestFile(
        "multilang.org",
        `#+TITLE: Multi Language Test

#+begin_src python :exec
print("python should be skipped")
#+end_src

#+begin_src javascript :exec
return "js should run";
#+end_src

#+begin_src css
.style { color: red; }
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].value).toBe("js should run");
    });

    it("should track execution time", async () => {
      const file = createTestFile(
        "timing.org",
        `#+TITLE: Timing Test

#+begin_src javascript :exec
return Date.now();
#+end_src
`
      );

      const result = await executeOrgFile({ file });

      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.outputs[0].executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
