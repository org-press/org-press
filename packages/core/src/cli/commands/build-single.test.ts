/**
 * Build Single File Tests
 *
 * Tests for the hashbang build functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { buildSingleFile, parseBuildArgs } from "./build-single.ts";

describe("Build Single File", () => {
  const testDir = path.join(process.cwd(), ".test-build-single");
  const testFile = path.join(testDir, "test.org");

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("parseBuildArgs", () => {
    it("should parse mode flag", () => {
      const args = parseBuildArgs(["--mode", "middleware"]);
      expect(args.mode).toBe("middleware");
    });

    it("should parse mode flag with equals", () => {
      const args = parseBuildArgs(["--mode=server"]);
      expect(args.mode).toBe("server");
    });

    it("should default to static mode", () => {
      const args = parseBuildArgs([]);
      expect(args.mode).toBe("static");
    });

    it("should parse out-dir flag", () => {
      const args = parseBuildArgs(["--out-dir", "/tmp/output"]);
      expect(args.outDir).toBe("/tmp/output");
    });

    it("should parse base flag", () => {
      const args = parseBuildArgs(["--base", "/app/"]);
      expect(args.base).toBe("/app/");
    });

    it("should parse minify flag", () => {
      const args = parseBuildArgs(["--minify"]);
      expect(args.minify).toBe(true);
    });

    it("should parse sourcemap flag", () => {
      const args = parseBuildArgs(["--sourcemap"]);
      expect(args.sourcemap).toBe(true);
    });
  });

  describe("buildSingleFile - static mode", () => {
    it("should build a simple org file to HTML", async () => {
      const orgContent = `#+TITLE: Test Document

* Introduction

This is a test document.
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      expect(result.mode).toBe("static");
      expect(result.files).toContain("index.html");

      // Verify HTML output
      const htmlPath = path.join(result.outDir, "index.html");
      expect(fs.existsSync(htmlPath)).toBe(true);

      const html = fs.readFileSync(htmlPath, "utf-8");
      expect(html).toContain("Test Document");
      expect(html).toContain("Introduction");
      expect(html).toContain("This is a test document.");
    });

    it("should render headlines correctly", async () => {
      const orgContent = `#+TITLE: Headings Test

* Level 1

** Level 2

*** Level 3
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      // Title becomes h1, headlines become h2, h3, h4
      expect(html).toContain("<h1>Headings Test</h1>");
      expect(html).toContain("<h2>Level 1</h2>");
      expect(html).toContain("<h3>Level 2</h3>");
      expect(html).toContain("<h4>Level 3</h4>");
    });

    it("should handle code blocks", async () => {
      const orgContent = `#+TITLE: Code Test

* Example

#+begin_src javascript
const x = 42;
console.log(x);
#+end_src
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      expect(html).toContain('<code class="language-javascript">');
      expect(html).toContain("const x = 42;");
    });

    it("should skip API blocks from output", async () => {
      const orgContent = `#+TITLE: API Test

* Visible

Content here.

#+begin_src javascript :use api
export default (req, res) => res.json({ ok: true });
#+end_src
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      // API block code should not appear in output
      expect(html).not.toContain("res.json");
      expect(html).toContain("Content here.");
    });

    it("should handle server blocks by executing them", async () => {
      const orgContent = `#+TITLE: Server Block Test

* Dynamic Content

#+begin_src javascript :use server
export default "Hello from server!";
#+end_src
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      // Server block should show executed output, not source code
      expect(html).toContain("Hello from server!");
      expect(html).not.toContain("export default");
    });

    it("should handle withSourceCode wrapper", async () => {
      const orgContent = `#+TITLE: Source Code Test

* Example

#+begin_src javascript :use preview | withSourceCode
const greeting = "Hello";
#+end_src
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      // Should have source code section
      expect(html).toContain('class="org-source-code"');
      expect(html).toContain('class="org-source-label"');
    });

    it("should strip hashbang from org file", async () => {
      const orgContent = `#!/usr/bin/env orgp
#+TITLE: Hashbang Test

* Content
`;
      fs.writeFileSync(testFile, orgContent);

      const result = await buildSingleFile(testFile, {
        outDir: path.join(testDir, "dist"),
      });

      const htmlPath = path.join(result.outDir, "index.html");
      const html = fs.readFileSync(htmlPath, "utf-8");

      // Hashbang should not appear in output
      expect(html).not.toContain("#!/usr/bin/env");
      expect(html).toContain("Hashbang Test");
    });
  });
});
