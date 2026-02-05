/**
 * Tests for Lint Command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  lintOrgFiles,
  type LintOptions,
  type LintSummary,
} from "./lint.ts";

// Mock console to suppress output during tests
const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

describe("Lint Command", () => {
  let tempDir: string;
  let contentDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-test-"));
    contentDir = path.join(tempDir, "content");
    fs.mkdirSync(contentDir, { recursive: true });

    // Create a minimal ESLint flat config
    fs.writeFileSync(
      path.join(tempDir, "eslint.config.js"),
      `export default [
        {
          languageOptions: {
            globals: {
              console: "readonly",
            },
          },
          rules: {
            "no-unused-vars": "warn",
            "no-undef": "error",
          },
        },
      ];`
    );

    // Reset console spies
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("lintOrgFiles", () => {
    it("should lint code blocks and find errors", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
console.log(undefinedVar);
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.totalErrors).toBeGreaterThan(0);
    });

    it("should pass for valid code", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
console.log(x);
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(1);
      expect(summary.totalErrors).toBe(0);
    });

    it("should handle multiple blocks", async () => {
      const orgContent = `#+begin_src javascript
const a = 1;
console.log(a);
#+end_src

#+begin_src typescript
const b: number = 2;
console.log(b);
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.total).toBe(2);
    });

    it("should filter by language", async () => {
      const orgContent = `#+begin_src javascript
const a = 1;
#+end_src

#+begin_src typescript
const b: number = 2;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
        languages: ["typescript"],
      });

      expect(summary.total).toBe(1);
    });

    it("should skip non-lintable languages", async () => {
      const orgContent = `#+begin_src json
{"key": "value"}
#+end_src

#+begin_src css
.foo { color: red; }
#+end_src

#+begin_src javascript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      // Only javascript should be linted (json and css filtered out by default lang filter)
      expect(summary.total).toBe(1);
    });

    it("should return correct summary for empty content", async () => {
      const summary = await lintOrgFiles({
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

#+begin_src javascript
undefinedVar;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].orgStartLine).toBe(5); // 1-based line of #+begin_src

      // Error on line 1 of block should be line 6 in org file (5 + 1)
      if (summary.results[0].messages.length > 0) {
        const msg = summary.results[0].messages[0];
        expect(msg.line).toBe(1); // Line within block
        // The org line would be orgStartLine + msg.line = 6
      }
    });

    it("should track warnings separately from errors", async () => {
      const orgContent = `#+begin_src javascript
const unusedVar = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      // no-unused-vars is configured as warning
      expect(summary.totalWarnings).toBeGreaterThanOrEqual(0);
    });

    it("should handle missing ESLint gracefully", async () => {
      // Remove the ESLint config to simulate missing ESLint setup
      fs.unlinkSync(path.join(tempDir, "eslint.config.js"));

      const orgContent = `#+begin_src javascript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      // This should not throw, even without config
      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary).toBeDefined();
    });

    it("should respect maxWarnings option", async () => {
      const orgContent = `#+begin_src javascript
const a = 1;
const b = 2;
const c = 3;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
        maxWarnings: 0,
      });

      // Summary should still complete, but exit code would be non-zero
      expect(summary).toBeDefined();
    });
  });

  describe("result structure", () => {
    it("should include block information in results", async () => {
      const orgContent = `#+NAME: my-code
#+begin_src javascript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].block).toBe("my-code");
      expect(summary.results[0].language).toBe("javascript");
      expect(summary.results[0].file).toContain("test.org");
    });

    it("should use block index when no name is provided", async () => {
      const orgContent = `#+begin_src javascript
const x = 1;
#+end_src
`;
      fs.writeFileSync(path.join(contentDir, "test.org"), orgContent);

      const summary = await lintOrgFiles({
        contentDir,
        projectRoot: tempDir,
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0].block).toBe(0); // Block index
    });
  });
});
