/**
 * Tests for Cross-File Layout Resolution
 *
 * Tests the ability to reference layouts/wrappers from external .org files:
 * - #+LAYOUT: ./layouts.org#base-layout
 * - #+WRAPPER: ../shared/wrappers.org#article
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  isCrossFileLayoutRef,
  parseCrossFileLayoutRef,
  resolveCrossFilePath,
  loadCrossFileLayout,
  clearCrossFileCache,
  getCachedFilePaths,
} from "./cross-file-layout.ts";

describe("Cross-File Layout Resolution", () => {
  describe("isCrossFileLayoutRef", () => {
    it("returns true for relative path with block name", () => {
      expect(isCrossFileLayoutRef("./layouts.org#base")).toBe(true);
      expect(isCrossFileLayoutRef("./path/to/layouts.org#my-layout")).toBe(true);
      expect(isCrossFileLayoutRef("../shared/layouts.org#article")).toBe(true);
    });

    it("returns true for absolute path with block name", () => {
      expect(isCrossFileLayoutRef("/layouts/base.org#main")).toBe(true);
      expect(isCrossFileLayoutRef("/shared/wrappers.org#article-wrapper")).toBe(true);
    });

    it("returns false for self-reference (#block)", () => {
      expect(isCrossFileLayoutRef("#my-layout")).toBe(false);
      expect(isCrossFileLayoutRef("#block-name")).toBe(false);
    });

    it("returns false for theme name (no path)", () => {
      expect(isCrossFileLayoutRef("default")).toBe(false);
      expect(isCrossFileLayoutRef("blog")).toBe(false);
      expect(isCrossFileLayoutRef("minimal")).toBe(false);
    });

    it("returns false for empty/undefined", () => {
      expect(isCrossFileLayoutRef(undefined)).toBe(false);
      expect(isCrossFileLayoutRef("")).toBe(false);
    });

    it("returns false for paths without .org extension", () => {
      expect(isCrossFileLayoutRef("./layouts.ts#block")).toBe(false);
      expect(isCrossFileLayoutRef("./layouts.js#block")).toBe(false);
      expect(isCrossFileLayoutRef("./layouts#block")).toBe(false);
    });

    it("returns false for paths without block name", () => {
      expect(isCrossFileLayoutRef("./layouts.org")).toBe(false);
      expect(isCrossFileLayoutRef("./layouts.org#")).toBe(false);
    });

    it("returns false for non-path references with #", () => {
      expect(isCrossFileLayoutRef("layouts.org#block")).toBe(false);
      expect(isCrossFileLayoutRef("theme#block")).toBe(false);
    });
  });

  describe("parseCrossFileLayoutRef", () => {
    it("parses relative path correctly", () => {
      const result = parseCrossFileLayoutRef("./layouts.org#base");
      expect(result).toEqual({
        filePath: "./layouts.org",
        blockName: "base",
        isAbsolute: false,
      });
    });

    it("parses parent directory path", () => {
      const result = parseCrossFileLayoutRef("../shared/layouts.org#article-wrapper");
      expect(result).toEqual({
        filePath: "../shared/layouts.org",
        blockName: "article-wrapper",
        isAbsolute: false,
      });
    });

    it("parses deeply nested relative path", () => {
      const result = parseCrossFileLayoutRef("../../common/themes/layouts.org#blog");
      expect(result).toEqual({
        filePath: "../../common/themes/layouts.org",
        blockName: "blog",
        isAbsolute: false,
      });
    });

    it("parses absolute path", () => {
      const result = parseCrossFileLayoutRef("/layouts/base.org#main-layout");
      expect(result).toEqual({
        filePath: "/layouts/base.org",
        blockName: "main-layout",
        isAbsolute: true,
      });
    });

    it("returns null for invalid refs", () => {
      expect(parseCrossFileLayoutRef("#my-layout")).toBeNull();
      expect(parseCrossFileLayoutRef("default")).toBeNull();
      expect(parseCrossFileLayoutRef("./layouts.org")).toBeNull();
      expect(parseCrossFileLayoutRef("")).toBeNull();
    });

    it("handles block names with various characters", () => {
      const result1 = parseCrossFileLayoutRef("./layouts.org#my-layout");
      expect(result1?.blockName).toBe("my-layout");

      const result2 = parseCrossFileLayoutRef("./layouts.org#layout_with_underscores");
      expect(result2?.blockName).toBe("layout_with_underscores");

      const result3 = parseCrossFileLayoutRef("./layouts.org#Layout123");
      expect(result3?.blockName).toBe("Layout123");
    });
  });

  describe("resolveCrossFilePath", () => {
    const contentDir = "/project/content";

    it("resolves relative path from current file", () => {
      const ref = {
        filePath: "./layouts.org",
        blockName: "base",
        isAbsolute: false,
      };
      const currentFile = "/project/content/blog/post.org";

      const result = resolveCrossFilePath(ref, currentFile, contentDir);
      expect(result).toBe("/project/content/blog/layouts.org");
    });

    it("resolves parent directory path", () => {
      const ref = {
        filePath: "../shared/layouts.org",
        blockName: "base",
        isAbsolute: false,
      };
      const currentFile = "/project/content/blog/post.org";

      const result = resolveCrossFilePath(ref, currentFile, contentDir);
      expect(result).toBe("/project/content/shared/layouts.org");
    });

    it("resolves deeply nested relative path", () => {
      const ref = {
        filePath: "../../layouts.org",
        blockName: "base",
        isAbsolute: false,
      };
      const currentFile = "/project/content/blog/2024/post.org";

      const result = resolveCrossFilePath(ref, currentFile, contentDir);
      expect(result).toBe("/project/content/layouts.org");
    });

    it("resolves absolute path from content dir", () => {
      const ref = {
        filePath: "/layouts/base.org",
        blockName: "main",
        isAbsolute: true,
      };
      const currentFile = "/project/content/blog/post.org";

      const result = resolveCrossFilePath(ref, currentFile, contentDir);
      expect(result).toBe("/project/content/layouts/base.org");
    });

    it("resolves absolute path at content root", () => {
      const ref = {
        filePath: "/layouts.org",
        blockName: "base",
        isAbsolute: true,
      };
      const currentFile = "/project/content/blog/post.org";

      const result = resolveCrossFilePath(ref, currentFile, contentDir);
      expect(result).toBe("/project/content/layouts.org");
    });
  });

  describe("loadCrossFileLayout", () => {
    const testDir = join(process.cwd(), ".test-cross-file-layout");
    const contentDir = testDir;

    beforeEach(async () => {
      // Create test directory structure
      await mkdir(join(testDir, "shared"), { recursive: true });
      await mkdir(join(testDir, "blog"), { recursive: true });
      clearCrossFileCache();
    });

    afterEach(async () => {
      // Clean up test directory
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      clearCrossFileCache();
    });

    it("loads layout block from external file", async () => {
      // Create layout file
      const layoutContent = `#+TITLE: Layouts

#+NAME: base
#+begin_src js
function layout({ content, metadata }) {
  return '<html><body>' + content + '</body></html>';
}
#+end_src
`;
      await writeFile(join(testDir, "layouts.org"), layoutContent);

      // Create page file
      await writeFile(join(testDir, "page.org"), "#+TITLE: Page");

      // Load the layout
      const result = await loadCrossFileLayout(
        "./layouts.org#base",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe("base");
      expect(result?.type).toBe("js");
      expect(result?.code).toContain("function layout");
    });

    it("loads layout with TypeScript block", async () => {
      const layoutContent = `#+TITLE: Layouts

#+NAME: typed-layout
#+begin_src tsx
function Layout({ content }: { content: string }) {
  return <html><body>{content}</body></html>;
}
#+end_src
`;
      await writeFile(join(testDir, "layouts.org"), layoutContent);

      const result = await loadCrossFileLayout(
        "./layouts.org#typed-layout",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result).toBeDefined();
      expect(result?.type).toBe("tsx");
      expect(result?.language).toBe("tsx");
    });

    it("loads layout from parent directory", async () => {
      const layoutContent = `#+TITLE: Shared Layouts

#+NAME: article
#+begin_src js
function wrapper({ content }) {
  return '<article>' + content + '</article>';
}
#+end_src
`;
      await writeFile(join(testDir, "shared", "layouts.org"), layoutContent);

      const result = await loadCrossFileLayout(
        "../shared/layouts.org#article",
        join(testDir, "blog", "post.org"),
        contentDir
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe("article");
      expect(result?.code).toContain("function wrapper");
    });

    it("loads layout from absolute path", async () => {
      await mkdir(join(testDir, "layouts"), { recursive: true });

      const layoutContent = `#+TITLE: Base Layouts

#+NAME: main
#+begin_src js
function layout({ content }) { return content; }
#+end_src
`;
      await writeFile(join(testDir, "layouts", "base.org"), layoutContent);

      const result = await loadCrossFileLayout(
        "/layouts/base.org#main",
        join(testDir, "blog", "post.org"),
        contentDir
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe("main");
    });

    it("returns undefined for non-existent file", async () => {
      const result = await loadCrossFileLayout(
        "./nonexistent.org#base",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result).toBeUndefined();
    });

    it("returns undefined for non-existent block", async () => {
      const layoutContent = `#+TITLE: Layouts

#+NAME: existing
#+begin_src js
function layout() {}
#+end_src
`;
      await writeFile(join(testDir, "layouts.org"), layoutContent);

      const result = await loadCrossFileLayout(
        "./layouts.org#nonexistent",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result).toBeUndefined();
    });

    it("caches parsed files", async () => {
      const layoutContent = `#+TITLE: Layouts

#+NAME: base
#+begin_src js
function layout() {}
#+end_src
`;
      await writeFile(join(testDir, "layouts.org"), layoutContent);

      // Load first time
      await loadCrossFileLayout(
        "./layouts.org#base",
        join(testDir, "page.org"),
        contentDir
      );

      // Verify cache contains the file
      const cachedPaths = getCachedFilePaths();
      expect(cachedPaths.some((p) => p.includes("layouts.org"))).toBe(true);

      // Load second time (should use cache)
      const result = await loadCrossFileLayout(
        "./layouts.org#base",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result).toBeDefined();
    });

    it("handles multiple blocks in same file", async () => {
      const layoutContent = `#+TITLE: Layouts

#+NAME: layout-one
#+begin_src js
function layout() { return 'one'; }
#+end_src

#+NAME: layout-two
#+begin_src js
function layout() { return 'two'; }
#+end_src
`;
      await writeFile(join(testDir, "layouts.org"), layoutContent);

      const result1 = await loadCrossFileLayout(
        "./layouts.org#layout-one",
        join(testDir, "page.org"),
        contentDir
      );

      const result2 = await loadCrossFileLayout(
        "./layouts.org#layout-two",
        join(testDir, "page.org"),
        contentDir
      );

      expect(result1?.code).toContain("'one'");
      expect(result2?.code).toContain("'two'");
    });
  });

  describe("clearCrossFileCache", () => {
    const testDir = join(process.cwd(), ".test-cache-clear");

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
      clearCrossFileCache();
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
      clearCrossFileCache();
    });

    it("clears specific file from cache", async () => {
      const layoutContent = `#+TITLE: Layouts
#+NAME: base
#+begin_src js
function layout() {}
#+end_src
`;
      const filePath = join(testDir, "layouts.org");
      await writeFile(filePath, layoutContent);

      // Load to populate cache
      await loadCrossFileLayout(
        "./layouts.org#base",
        join(testDir, "page.org"),
        testDir
      );

      expect(getCachedFilePaths()).toContain(filePath);

      // Clear specific file
      clearCrossFileCache(filePath);

      expect(getCachedFilePaths()).not.toContain(filePath);
    });

    it("clears entire cache when no path specified", async () => {
      const filePath = join(testDir, "layouts.org");
      await writeFile(
        filePath,
        `#+NAME: base\n#+begin_src js\nfunction layout() {}\n#+end_src`
      );

      await loadCrossFileLayout(
        "./layouts.org#base",
        join(testDir, "page.org"),
        testDir
      );

      expect(getCachedFilePaths().length).toBeGreaterThan(0);

      clearCrossFileCache();

      expect(getCachedFilePaths().length).toBe(0);
    });
  });
});
