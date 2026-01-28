import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  resolveBuildOutputs,
  getSingleFileOutput,
  ensureOutputDir,
  writeOutput,
  cleanOutputDir,
  getRelativeOutputPath,
  orgToOutputPath,
} from "./output.ts";

describe("Build Output", () => {
  let tempDir: string;
  let contentDir: string;
  let outDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "output-test-"));
    contentDir = path.join(tempDir, "content");
    outDir = path.join(tempDir, "dist");
    fs.mkdirSync(contentDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  function createFile(relativePath: string, content = ""): void {
    const fullPath = path.join(contentDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  describe("resolveBuildOutputs", () => {
    it("should resolve outputs for empty directory", () => {
      const outputs = resolveBuildOutputs({ contentDir, outDir });

      expect(outputs.entries).toHaveLength(0);
      expect(outputs.pageCount).toBe(0);
    });

    it("should resolve outputs for single file", () => {
      createFile("index.org");
      const outputs = resolveBuildOutputs({ contentDir, outDir });

      expect(outputs.entries).toHaveLength(1);
      expect(outputs.entries[0].urlPath).toBe("/");
      expect(outputs.entries[0].outputPath).toBe(path.join(outDir, "index.html"));
    });

    it("should resolve outputs with clean URLs", () => {
      createFile("about.org");
      const outputs = resolveBuildOutputs({ contentDir, outDir, cleanUrls: true });

      expect(outputs.entries).toHaveLength(1);
      expect(outputs.entries[0].outputPath).toBe(
        path.join(outDir, "about", "index.html")
      );
    });

    it("should resolve outputs without clean URLs", () => {
      createFile("about.org");
      const outputs = resolveBuildOutputs({ contentDir, outDir, cleanUrls: false });

      expect(outputs.entries).toHaveLength(1);
      expect(outputs.entries[0].outputPath).toBe(path.join(outDir, "about.html"));
    });

    it("should resolve nested directory outputs", () => {
      createFile("guide/index.org");
      createFile("guide/intro.org");
      const outputs = resolveBuildOutputs({ contentDir, outDir });

      expect(outputs.entries).toHaveLength(2);

      const guideIndex = outputs.entries.find((e) => e.urlPath === "/guide");
      expect(guideIndex?.outputPath).toBe(
        path.join(outDir, "guide", "index.html")
      );

      const intro = outputs.entries.find((e) => e.urlPath === "/guide/intro");
      expect(intro?.outputPath).toBe(
        path.join(outDir, "guide", "intro", "index.html")
      );
    });
  });

  describe("getSingleFileOutput", () => {
    it("should return index.html in output dir", () => {
      const output = getSingleFileOutput("test.org", outDir);
      expect(output).toBe(path.join(outDir, "index.html"));
    });

    it("should handle absolute paths", () => {
      const output = getSingleFileOutput("/path/to/test.org", outDir);
      expect(output).toBe(path.join(outDir, "index.html"));
    });
  });

  describe("ensureOutputDir", () => {
    it("should create directory if it does not exist", () => {
      const filePath = path.join(outDir, "nested", "deep", "file.html");

      expect(fs.existsSync(path.dirname(filePath))).toBe(false);

      ensureOutputDir(filePath);

      expect(fs.existsSync(path.dirname(filePath))).toBe(true);
    });

    it("should not error if directory exists", () => {
      const filePath = path.join(outDir, "file.html");
      fs.mkdirSync(outDir, { recursive: true });

      expect(() => ensureOutputDir(filePath)).not.toThrow();
    });
  });

  describe("writeOutput", () => {
    it("should write file with content", () => {
      const filePath = path.join(outDir, "test.html");

      writeOutput(filePath, "<html>test</html>");

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, "utf-8")).toBe("<html>test</html>");
    });

    it("should create parent directories", () => {
      const filePath = path.join(outDir, "nested", "test.html");

      writeOutput(filePath, "<html>nested</html>");

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("cleanOutputDir", () => {
    it("should remove existing directory", () => {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "old.html"), "old content");

      cleanOutputDir(outDir);

      expect(fs.existsSync(outDir)).toBe(true);
      expect(fs.existsSync(path.join(outDir, "old.html"))).toBe(false);
    });

    it("should create directory if it does not exist", () => {
      expect(fs.existsSync(outDir)).toBe(false);

      cleanOutputDir(outDir);

      expect(fs.existsSync(outDir)).toBe(true);
    });
  });

  describe("getRelativeOutputPath", () => {
    it("should return relative path from outDir", () => {
      const outputPath = path.join(outDir, "guide", "intro", "index.html");

      const relative = getRelativeOutputPath(outputPath, outDir);

      expect(relative).toBe(path.join("guide", "intro", "index.html"));
    });
  });

  describe("orgToOutputPath", () => {
    it("should convert index.org to index.html", () => {
      const output = orgToOutputPath("index.org", outDir);
      expect(output).toBe(path.join(outDir, "index.html"));
    });

    it("should convert page.org to page/index.html with clean URLs", () => {
      const output = orgToOutputPath("about.org", outDir, { cleanUrls: true });
      expect(output).toBe(path.join(outDir, "about", "index.html"));
    });

    it("should convert page.org to page.html without clean URLs", () => {
      const output = orgToOutputPath("about.org", outDir, { cleanUrls: false });
      expect(output).toBe(path.join(outDir, "about.html"));
    });

    it("should handle nested paths with clean URLs", () => {
      const output = orgToOutputPath("guide/intro.org", outDir, {
        cleanUrls: true,
      });
      expect(output).toBe(path.join(outDir, "guide", "intro", "index.html"));
    });

    it("should handle nested index files", () => {
      const output = orgToOutputPath("guide/index.org", outDir);
      expect(output).toBe(path.join(outDir, "guide", "index.html"));
    });
  });
});
