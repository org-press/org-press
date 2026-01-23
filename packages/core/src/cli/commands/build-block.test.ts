/**
 * Tests for build-block command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseBuildBlockArgs,
  extractNamedBlocks,
  buildBlock,
  type BuildBlockOptions,
} from "./build-block.ts";

describe("Build Block Command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-block-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const sampleOrgFile = `#+TITLE: Sample Plugin

* Plugin Implementation

#+NAME: plugin
#+begin_src typescript
import type { BlockPlugin } from "org-press";

export const myPlugin: BlockPlugin = {
  name: "my-plugin",
  async transform(block, ctx) {
    return { html: "<div>Hello</div>" };
  },
};

export default myPlugin;
#+end_src

* Helper Functions

#+NAME: helper
#+begin_src typescript
export function formatData(data: any): string {
  return JSON.stringify(data, null, 2);
}
#+end_src

* Styles

#+NAME: styles
#+begin_src css
.my-plugin {
  color: blue;
  font-size: 1rem;
}
#+end_src
`;

  describe("parseBuildBlockArgs", () => {
    it("should parse --block flag with single block", () => {
      const args = ["index.org", "--block", "plugin"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.file).toBe("index.org");
      expect(result!.blocks).toEqual(["plugin"]);
      expect(result!.outDir).toBe("dist");
    });

    it("should parse --block flag with multiple blocks", () => {
      const args = ["index.org", "--block", "plugin,helper"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.blocks).toEqual(["plugin", "helper"]);
    });

    it("should parse --out flag", () => {
      const args = ["index.org", "--block", "plugin", "--out", "build"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.outDir).toBe("build");
    });

    it("should parse --format flag", () => {
      const args = ["index.org", "--block", "plugin", "--format", "cjs"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.format).toBe("cjs");
    });

    it("should parse --no-declaration flag", () => {
      const args = ["index.org", "--block", "plugin", "--no-declaration"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.declaration).toBe(false);
    });

    it("should return null if no --block flag", () => {
      const args = ["index.org", "--out", "dist"];
      const result = parseBuildBlockArgs(args);

      expect(result).toBeNull();
    });

    it("should parse short flags", () => {
      const args = ["index.org", "-b", "plugin", "-o", "out"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.blocks).toEqual(["plugin"]);
      expect(result!.outDir).toBe("out");
    });

    it("should parse --block=value format", () => {
      const args = ["index.org", "--block=plugin,helper"];
      const result = parseBuildBlockArgs(args);

      expect(result).not.toBeNull();
      expect(result!.blocks).toEqual(["plugin", "helper"]);
    });
  });

  describe("extractNamedBlocks", () => {
    it("should extract named blocks from org file", () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const blocks = extractNamedBlocks(orgPath);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].name).toBe("plugin");
      expect(blocks[1].name).toBe("helper");
      expect(blocks[2].name).toBe("styles");
    });

    it("should extract block language", () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const blocks = extractNamedBlocks(orgPath);

      expect(blocks[0].language).toBe("typescript");
      expect(blocks[2].language).toBe("css");
    });

    it("should extract block code", () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const blocks = extractNamedBlocks(orgPath);

      expect(blocks[0].code).toContain("BlockPlugin");
      expect(blocks[0].code).toContain("export default myPlugin");
      expect(blocks[1].code).toContain("formatData");
    });

    it("should throw for non-existent file", () => {
      expect(() => extractNamedBlocks("/non/existent/file.org")).toThrow(
        "Org file not found"
      );
    });

    it("should return empty array for file without named blocks", () => {
      const orgPath = path.join(tempDir, "no-names.org");
      fs.writeFileSync(
        orgPath,
        `#+TITLE: No Names

#+begin_src javascript
console.log("hello");
#+end_src
`
      );

      const blocks = extractNamedBlocks(orgPath);
      expect(blocks).toHaveLength(0);
    });
  });

  describe("buildBlock", () => {
    it("should compile TypeScript blocks to JavaScript", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      const result = await buildBlock({
        file: orgPath,
        blocks: ["plugin"],
        outDir,
        format: "esm",
        declaration: true,
        quiet: true,
      });

      expect(result.outDir).toBe(outDir);
      expect(fs.existsSync(path.join(outDir, "plugin.js"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "plugin.d.ts"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "index.js"))).toBe(true);
    });

    it("should generate index file with exports", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      await buildBlock({
        file: orgPath,
        blocks: ["plugin", "helper"],
        outDir,
        format: "esm",
        declaration: true,
        quiet: true,
      });

      const indexContent = fs.readFileSync(
        path.join(outDir, "index.js"),
        "utf-8"
      );
      expect(indexContent).toContain("export { default as plugin }");
      expect(indexContent).toContain("export { default as helper }");
    });

    it("should throw for missing blocks", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      await expect(
        buildBlock({
          file: orgPath,
          blocks: ["nonexistent"],
          outDir,
          format: "esm",
          declaration: true,
          quiet: true,
        })
      ).rejects.toThrow("Blocks not found: nonexistent");
    });

    it("should skip declaration generation when disabled", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      await buildBlock({
        file: orgPath,
        blocks: ["plugin"],
        outDir,
        format: "esm",
        declaration: false,
        quiet: true,
      });

      expect(fs.existsSync(path.join(outDir, "plugin.js"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "plugin.d.ts"))).toBe(false);
    });

    it("should handle CSS blocks", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      await buildBlock({
        file: orgPath,
        blocks: ["styles"],
        outDir,
        format: "esm",
        declaration: true,
        quiet: true,
      });

      const stylesContent = fs.readFileSync(
        path.join(outDir, "styles.js"),
        "utf-8"
      );
      expect(stylesContent).toContain(".my-plugin");
    });

    it("should compile multiple blocks", async () => {
      const orgPath = path.join(tempDir, "sample.org");
      fs.writeFileSync(orgPath, sampleOrgFile);

      const outDir = path.join(tempDir, "dist");

      const result = await buildBlock({
        file: orgPath,
        blocks: ["plugin", "helper", "styles"],
        outDir,
        format: "esm",
        declaration: true,
        quiet: true,
      });

      expect(result.files.filter((f) => f.type === "js")).toHaveLength(4); // 3 blocks + index
      expect(result.files.filter((f) => f.type === "dts")).toHaveLength(4);
    });
  });
});
