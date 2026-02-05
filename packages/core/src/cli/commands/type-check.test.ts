/**
 * Tests for Type-Check Command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  typeCheckOrgFiles,
  isTypeCheckableLanguage,
  runTypeCheck,
  type TypeCheckOptions,
  type TypeCheckSummary,
} from "./type-check.ts";
import { clearConfigCache } from "../config-loader.ts";

// Mock console to suppress output during tests
const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

describe("Type-Check Command", () => {
  let tempDir: string;
  let contentDir: string;

  beforeEach(() => {
    // Clear config cache to ensure fresh config loading
    clearConfigCache();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "type-check-test-"));
    contentDir = path.join(tempDir, "content");
    fs.mkdirSync(contentDir, { recursive: true });

    // Create a minimal tsconfig.json
    fs.writeFileSync(
      path.join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "bundler",
        },
      })
    );

    // Reset console spies
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("isTypeCheckableLanguage", () => {
    it("should return true for typescript", () => {
      expect(isTypeCheckableLanguage("typescript")).toBe(true);
    });

    it("should return true for ts", () => {
      expect(isTypeCheckableLanguage("ts")).toBe(true);
    });

    it("should return true for tsx", () => {
      expect(isTypeCheckableLanguage("tsx")).toBe(true);
    });

    it("should return false for javascript", () => {
      expect(isTypeCheckableLanguage("javascript")).toBe(false);
    });

    it("should return false for other languages", () => {
      expect(isTypeCheckableLanguage("python")).toBe(false);
      expect(isTypeCheckableLanguage("css")).toBe(false);
      expect(isTypeCheckableLanguage("json")).toBe(false);
    });
  });

  describe("typeCheckOrgFiles", () => {
    it("should type-check code blocks and find errors", async () => {
      const orgContent = `#+begin_src typescript
const x: number = "not a number";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.totalErrors).toBeGreaterThan(0);
      expect(summary.blocksWithErrors).toBe(1);
    });

    it("should pass for valid TypeScript code", async () => {
      const orgContent = `#+begin_src typescript
const x: number = 42;
const y: string = "hello";
console.log(x, y);
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.totalErrors).toBe(0);
      expect(summary.blocksPassed).toBe(1);
    });

    it("should handle multiple blocks", async () => {
      const orgContent = `#+begin_src typescript
const a: number = 1;
#+end_src

#+begin_src ts
const b: string = "hello";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(2);
    });

    it("should skip non-type-checkable languages", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
#+end_src

#+begin_src css
.foo { color: red; }
#+end_src

#+begin_src typescript
const y: number = 2;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      // Only TypeScript should be type-checked
      expect(summary.total).toBe(1);
    });

    it("should return correct summary for empty content", async () => {
      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.totalWarnings).toBe(0);
      expect(summary.results).toHaveLength(0);
    });

    it("should calculate org file line numbers correctly", async () => {
      const orgContent = `#+TITLE: Test

Some text here.

#+begin_src typescript
const x: number = "wrong type";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].orgStartLine).toBe(5); // 1-based line of #+begin_src

      // Error should have been mapped back to org file line
      if (summary.results[0].diagnostics.length > 0) {
        const diag = summary.results[0].diagnostics[0];
        // Error on line 1 of block should be line 6 in org file (5 + 1)
        expect(diag.line).toBe(6);
      }
    });

    it("should handle TSX blocks", async () => {
      const orgContent = `#+begin_src tsx
const Component = (): JSX.Element => {
  const x: number = "wrong";
  return <div>Hello</div>;
};
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      // Create a minimal tsconfig with JSX support
      fs.writeFileSync(
        path.join(tempDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: "ES2020",
            module: "ESNext",
            jsx: "react-jsx",
          },
        })
      );

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      // Should find the type error (string assigned to number)
      expect(summary.totalErrors).toBeGreaterThan(0);
    });

    it("should filter by specific files", async () => {
      fs.writeFileSync(
        path.join(contentDir, "file1.org"),
        `#+begin_src typescript
const a: number = 1;
#+end_src`
      );
      fs.writeFileSync(
        path.join(contentDir, "file2.org"),
        `#+begin_src typescript
const b: string = "hello";
#+end_src`
      );

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
        files: ["file1.org"],
      });

      expect(summary.total).toBe(1);
      expect(summary.results[0].file).toContain("file1.org");
    });
  });

  describe("result structure", () => {
    it("should include block information in results", async () => {
      const orgContent = `#+NAME: my-typescript-code
#+begin_src typescript
const x: number = 42;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].block).toBe("my-typescript-code");
      expect(summary.results[0].language).toBe("typescript");
      expect(summary.results[0].file).toContain("test.org");
    });

    it("should use block index when no name is provided", async () => {
      const orgContent = `#+begin_src typescript
const x: number = 42;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].block).toBe(0); // Block index
    });

    it("should separate errors from warnings in results", async () => {
      const orgContent = `#+begin_src typescript
const x: number = "wrong";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.totalErrors).toBeGreaterThan(0);
      expect(summary.blocksWithErrors).toBe(1);
      expect(summary.results[0].errorCount).toBeGreaterThan(0);
    });
  });

  describe("runTypeCheck", () => {
    it("should return 0 for successful type-check", async () => {
      const orgContent = `#+begin_src typescript
const x: number = 42;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const exitCode = await runTypeCheck([], {
        contentDir,
        projectRoot: tempDir,
      });

      expect(exitCode).toBe(0);
    });

    it("should return 1 when errors are found", async () => {
      const orgContent = `#+begin_src typescript
const x: number = "not a number";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const exitCode = await runTypeCheck([], {
        contentDir,
        projectRoot: tempDir,
      });

      expect(exitCode).toBe(1);
    });

    it("should accept file arguments", async () => {
      fs.writeFileSync(
        path.join(contentDir, "file1.org"),
        `#+begin_src typescript
const a: number = "wrong";
#+end_src`
      );
      fs.writeFileSync(
        path.join(contentDir, "file2.org"),
        `#+begin_src typescript
const b: number = 42;
#+end_src`
      );

      // Check only file2.org which has no errors
      const exitCode = await runTypeCheck(["file2.org"], {
        contentDir,
        projectRoot: tempDir,
      });

      expect(exitCode).toBe(0);
    });
  });

  describe("diagnostic details", () => {
    it("should include TypeScript error codes", async () => {
      const orgContent = `#+begin_src typescript
const x: number = "string";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results[0].diagnostics.length).toBeGreaterThan(0);
      const diag = summary.results[0].diagnostics[0];
      expect(diag.code).toBeDefined();
      expect(typeof diag.code).toBe("number");
      expect(diag.severity).toBe("error");
    });

    it("should include error messages", async () => {
      const orgContent = `#+begin_src typescript
const x: number = "string";
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await typeCheckOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      const diag = summary.results[0].diagnostics[0];
      expect(diag.message).toBeDefined();
      expect(diag.message.length).toBeGreaterThan(0);
    });
  });
});
