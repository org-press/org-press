import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  getTargetType,
  hasGlobPattern,
  resolveTarget,
  formatTarget,
} from "./target.ts";

describe("Target Resolution", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "target-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true });
  });

  function createFile(relativePath: string, content = ""): string {
    const fullPath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
  }

  function createDir(relativePath: string): string {
    const fullPath = path.join(tempDir, relativePath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
  }

  describe("hasGlobPattern", () => {
    it("should detect * pattern", () => {
      expect(hasGlobPattern("*.org")).toBe(true);
      expect(hasGlobPattern("content/*.org")).toBe(true);
    });

    it("should detect ** pattern", () => {
      expect(hasGlobPattern("**/*.org")).toBe(true);
    });

    it("should detect ? pattern", () => {
      expect(hasGlobPattern("file?.org")).toBe(true);
    });

    it("should detect [...] pattern", () => {
      expect(hasGlobPattern("file[123].org")).toBe(true);
    });

    it("should detect {...} pattern", () => {
      expect(hasGlobPattern("{a,b}.org")).toBe(true);
    });

    it("should return false for normal paths", () => {
      expect(hasGlobPattern("file.org")).toBe(false);
      expect(hasGlobPattern("content/guide/intro.org")).toBe(false);
      expect(hasGlobPattern("./relative/path.org")).toBe(false);
    });
  });

  describe("getTargetType", () => {
    it("should return 'file' for existing file", () => {
      createFile("test.org");
      expect(getTargetType("test.org")).toBe("file");
    });

    it("should return 'directory' for existing directory", () => {
      createDir("content");
      expect(getTargetType("content")).toBe("directory");
    });

    it("should return 'glob' for glob patterns", () => {
      expect(getTargetType("*.org")).toBe("glob");
      expect(getTargetType("**/*.org")).toBe("glob");
      expect(getTargetType("content/*.org")).toBe("glob");
    });

    it("should return 'file' for non-existent path without glob", () => {
      expect(getTargetType("nonexistent.org")).toBe("file");
    });
  });

  describe("resolveTarget", () => {
    describe("no target (project mode)", () => {
      it("should return project type", async () => {
        const result = await resolveTarget(undefined);

        expect(result.type).toBe("project");
        expect(result.files).toEqual([]);
        expect(result.baseDir).toBe(tempDir);
      });
    });

    describe("file target", () => {
      it("should resolve single file", async () => {
        const file = createFile("test.org");
        const result = await resolveTarget("test.org");

        expect(result.type).toBe("file");
        expect(result.files).toEqual([file]);
        expect(result.baseDir).toBe(tempDir);
      });

      it("should throw for non-existent file", async () => {
        await expect(resolveTarget("nonexistent.org")).rejects.toThrow(
          "File not found"
        );
      });

      it("should throw for non-org file", async () => {
        createFile("test.txt");
        await expect(resolveTarget("test.txt")).rejects.toThrow(
          "Not an org file"
        );
      });
    });

    describe("directory target", () => {
      it("should resolve directory with org files", async () => {
        createFile("content/index.org");
        createFile("content/about.org");
        createFile("content/guide/intro.org");
        createFile("content/readme.md");

        const result = await resolveTarget("content");

        expect(result.type).toBe("directory");
        expect(result.files).toHaveLength(3);
        expect(result.files.every((f) => f.endsWith(".org"))).toBe(true);
      });

      it("should skip node_modules", async () => {
        createFile("content/page.org");
        createFile("content/node_modules/package.org");

        const result = await resolveTarget("content");

        expect(result.files).toHaveLength(1);
      });

      it("should skip hidden directories", async () => {
        createFile("content/page.org");
        createFile("content/.hidden/secret.org");

        const result = await resolveTarget("content");

        expect(result.files).toHaveLength(1);
      });
    });

    describe("glob target", () => {
      it("should expand *.org pattern", async () => {
        createFile("a.org");
        createFile("b.org");
        createFile("c.txt");

        const result = await resolveTarget("*.org");

        expect(result.type).toBe("glob");
        expect(result.files).toHaveLength(2);
      });

      it("should expand **/*.org pattern", async () => {
        createFile("root.org");
        createFile("dir/nested.org");
        createFile("dir/deep/deeper.org");

        const result = await resolveTarget("**/*.org");

        expect(result.type).toBe("glob");
        expect(result.files).toHaveLength(3);
      });

      it("should expand content/**/*.org pattern", async () => {
        createFile("content/page.org");
        createFile("content/guide/intro.org");
        createFile("other/file.org");

        const result = await resolveTarget("content/**/*.org");

        expect(result.type).toBe("glob");
        expect(result.files).toHaveLength(2);
        expect(result.files.every((f) => f.includes("content"))).toBe(true);
      });
    });
  });

  describe("formatTarget", () => {
    it("should format file target", () => {
      const result = formatTarget({
        type: "file",
        original: "test.org",
        files: ["/path/to/test.org"],
        baseDir: "/path/to",
      });

      expect(result).toBe("file: test.org");
    });

    it("should format directory target with count", () => {
      const result = formatTarget({
        type: "directory",
        original: "content",
        files: ["/a.org", "/b.org", "/c.org"],
        baseDir: "/content",
      });

      expect(result).toBe("directory: content (3 files)");
    });

    it("should format glob target with count", () => {
      const result = formatTarget({
        type: "glob",
        original: "**/*.org",
        files: ["/a.org", "/b.org"],
        baseDir: "/",
      });

      expect(result).toBe("glob: **/*.org (2 files)");
    });

    it("should format project mode", () => {
      const result = formatTarget({
        type: "project",
        original: "",
        files: [],
        baseDir: "/",
      });

      expect(result).toBe("project mode");
    });
  });
});
