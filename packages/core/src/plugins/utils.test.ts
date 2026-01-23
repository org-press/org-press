/**
 * Unit tests for plugin utilities
 *
 * Comprehensive tests for all utility functions with edge cases.
 * Target: 100% coverage of plugins/utils.ts
 */

import { describe, it, expect } from "vitest";
import {
  createBlockId,
  rewriteOrgImports,
  parseBlockParameters,
  usesPlugin,
  createVirtualModuleId,
  parseVirtualModuleId,
} from "./utils.ts";

describe("Plugin Utilities", () => {
  describe("createBlockId", () => {
    it("should generate stable block ID from path and index", () => {
      expect(createBlockId("content/index.org", 0)).toBe(
        "block-content-index-org-0"
      );
      expect(createBlockId("content/blog/post.org", 5)).toBe(
        "block-content-blog-post-org-5"
      );
    });

    it("should sanitize special characters", () => {
      expect(createBlockId("content/my post.org", 0)).toBe(
        "block-content-my-post-org-0"
      );
      expect(createBlockId("content/foo@bar#baz.org", 1)).toBe(
        "block-content-foo-bar-baz-org-1"
      );
    });

    it("should handle paths with slashes", () => {
      expect(createBlockId("docs/api/v1.org", 2)).toBe(
        "block-docs-api-v1-org-2"
      );
    });

    it("should handle paths with dots", () => {
      expect(createBlockId("lib/my.file.org", 0)).toBe(
        "block-lib-my-file-org-0"
      );
    });

    it("should be deterministic for same inputs", () => {
      const id1 = createBlockId("content/post.org", 3);
      const id2 = createBlockId("content/post.org", 3);
      expect(id1).toBe(id2);
    });
  });

  describe("rewriteOrgImports", () => {
    it("should rewrite .org imports to .html", () => {
      const code = 'import foo from "./other.org"';
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe('import foo from "./other.html"');
    });

    it("should handle single quotes", () => {
      const code = "import foo from './other.org'";
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe("import foo from './other.html'");
    });

    it("should preserve query param imports (virtual modules)", () => {
      // Query param imports are virtual module imports handled by virtual-blocks plugin
      // They should NOT be rewritten to .html
      const code = 'import foo from "./other.org?name=bar"';
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe('import foo from "./other.org?name=bar"');
    });

    it("should handle multiple imports", () => {
      const code = `
        import a from "./first.org";
        import b from "./second.org";
      `;
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toContain('./first.html"');
      expect(result).toContain('./second.html"');
    });

    it("should preserve non-.org imports", () => {
      const code = 'import react from "react"';
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe('import react from "react"');
    });

    it("should handle destructured imports", () => {
      const code = 'import { foo, bar } from "./lib.org"';
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe('import { foo, bar } from "./lib.html"');
    });

    it("should handle absolute path imports", () => {
      const code = 'import foo from "/lib/utils.org"';
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toBe('import foo from "/lib/utils.html"');
    });

    it("should handle mixed .org and non-.org imports", () => {
      const code = `
        import { useState } from "react";
        import { helper } from "./utils.org";
        import "./styles.css";
      `;
      const result = rewriteOrgImports(code, "content/index.org");
      expect(result).toContain('"react"');
      expect(result).toContain('./utils.html"');
      expect(result).toContain('"./styles.css"');
    });
  });

  describe("parseBlockParameters", () => {
    it("should parse simple parameters", () => {
      const params = parseBlockParameters(":use preview :height 400px");
      expect(params).toEqual({
        use: "preview",
        height: "400px",
      });
    });

    it("should parse parameters with values", () => {
      const params = parseBlockParameters(
        ":use jscad :exports results :height 600px"
      );
      expect(params).toEqual({
        use: "jscad",
        exports: "results",
        height: "600px",
      });
    });

    it("should handle empty/null meta", () => {
      expect(parseBlockParameters(null)).toEqual({});
      expect(parseBlockParameters(undefined)).toEqual({});
      expect(parseBlockParameters("")).toEqual({});
    });

    it("should handle single parameter", () => {
      const params = parseBlockParameters(":exports both");
      expect(params).toEqual({ exports: "both" });
    });

    it("should handle parameters with numeric values", () => {
      const params = parseBlockParameters(":height 400 :width 600");
      expect(params).toEqual({
        height: "400",
        width: "600",
      });
    });

    it("should handle parameters with special characters in values", () => {
      const params = parseBlockParameters(":file /path/to/file.js");
      expect(params).toEqual({
        file: "/path/to/file.js",
      });
    });

    it("should treat parameters without values as flags", () => {
      const params = parseBlockParameters(":exec :use preview");
      expect(params).toEqual({
        exec: "",
        use: "preview",
      });
    });

    it("should handle flag-only parameters", () => {
      const params = parseBlockParameters(":exec");
      expect(params).toEqual({ exec: "" });
    });

    it("should handle mixed flags and key-value parameters", () => {
      const params = parseBlockParameters(":exec :exports both");
      expect(params).toEqual({
        exec: "",
        exports: "both",
      });
    });

    it("should handle extra whitespace", () => {
      const params = parseBlockParameters("  :use   preview   :height   400px  ");
      expect(params).toEqual({
        use: "preview",
        height: "400px",
      });
    });
  });

  describe("usesPlugin", () => {
    it("should return true when :use parameter matches", () => {
      expect(usesPlugin(":use jscad :exports results", "jscad")).toBe(true);
      expect(usesPlugin(":use excalidraw :height 400px", "excalidraw")).toBe(
        true
      );
    });

    it("should return false when :use parameter doesn't match", () => {
      expect(usesPlugin(":use jscad :exports results", "excalidraw")).toBe(
        false
      );
      expect(usesPlugin(":exports both", "jscad")).toBe(false);
    });

    it("should return false when no :use parameter", () => {
      expect(usesPlugin(":height 400px", "jscad")).toBe(false);
      expect(usesPlugin("", "jscad")).toBe(false);
    });

    it("should return false when meta is null/undefined", () => {
      expect(usesPlugin(null, "jscad")).toBe(false);
      expect(usesPlugin(undefined, "jscad")).toBe(false);
    });

    it("should handle multiple parameters", () => {
      expect(usesPlugin(":height 400px :use jscad :name example", "jscad")).toBe(
        true
      );
    });

    it("should be case sensitive", () => {
      expect(usesPlugin(":use JSCad", "jscad")).toBe(false);
      expect(usesPlugin(":use jscad", "JSCad")).toBe(false);
    });
  });

  describe("createVirtualModuleId", () => {
    it("should create virtual module ID with block index", () => {
      const id = createVirtualModuleId("javascript", "content/post.org", 0, "js");
      expect(id).toBe("virtual:org-press:block:javascript:content/post.org:0.js");
    });

    it("should create virtual module ID with named block", () => {
      const id = createVirtualModuleId(
        "javascript",
        "lib/utils.org",
        0,
        "js",
        "helper"
      );
      expect(id).toBe(
        "virtual:org-press:block:javascript:lib/utils.org:NAME:helper.js"
      );
    });

    it("should handle different plugins", () => {
      const id1 = createVirtualModuleId("jscad", "content/3d.org", 2, "js");
      expect(id1).toBe("virtual:org-press:block:jscad:content/3d.org:2.js");

      const id2 = createVirtualModuleId("excalidraw", "docs/diagram.org", 1, "js");
      expect(id2).toBe(
        "virtual:org-press:block:excalidraw:docs/diagram.org:1.js"
      );
    });

    it("should handle different extensions", () => {
      const cssId = createVirtualModuleId("css", "content/styles.org", 0, "css");
      expect(cssId).toBe("virtual:org-press:block:css:content/styles.org:0.css");

      const tsxId = createVirtualModuleId(
        "javascript",
        "content/component.org",
        0,
        "tsx"
      );
      expect(tsxId).toBe(
        "virtual:org-press:block:javascript:content/component.org:0.tsx"
      );
    });

    it("should default to .js extension", () => {
      const id = createVirtualModuleId("javascript", "content/post.org", 0);
      expect(id).toBe("virtual:org-press:block:javascript:content/post.org:0.js");
    });
  });

  describe("parseVirtualModuleId", () => {
    it("should parse virtual module ID with block index", () => {
      const result = parseVirtualModuleId(
        "virtual:org-press:block:jscad:content/3d.org:2.js"
      );
      expect(result).toEqual({
        pluginName: "jscad",
        orgFilePath: "content/3d.org",
        blockIndex: 2,
        extension: "js",
      });
    });

    it("should parse virtual module ID with named block", () => {
      const result = parseVirtualModuleId(
        "virtual:org-press:block:javascript:lib.org:NAME:util.js"
      );
      expect(result).toEqual({
        pluginName: "javascript",
        orgFilePath: "lib.org",
        blockName: "util",
        extension: "js",
      });
    });

    it("should handle IDs with \\0 prefix", () => {
      const result = parseVirtualModuleId(
        "\0virtual:org-press:block:javascript:content/post.org:0.js"
      );
      expect(result).toEqual({
        pluginName: "javascript",
        orgFilePath: "content/post.org",
        blockIndex: 0,
        extension: "js",
      });
    });

    it("should return null for invalid IDs", () => {
      expect(parseVirtualModuleId("invalid")).toBeNull();
      expect(parseVirtualModuleId("virtual:other:id")).toBeNull();
      expect(parseVirtualModuleId("")).toBeNull();
    });

    it("should handle different extensions", () => {
      const cssResult = parseVirtualModuleId(
        "virtual:org-press:block:css:content/styles.org:0.css"
      );
      expect(cssResult?.extension).toBe("css");

      const tsxResult = parseVirtualModuleId(
        "virtual:org-press:block:javascript:content/component.org:0.tsx"
      );
      expect(tsxResult?.extension).toBe("tsx");
    });

    it("should handle complex file paths", () => {
      const result = parseVirtualModuleId(
        "virtual:org-press:block:javascript:content/blog/2024/post.org:0.js"
      );
      expect(result?.orgFilePath).toBe("content/blog/2024/post.org");
    });

    it("should be inverse of createVirtualModuleId", () => {
      const originalId = createVirtualModuleId(
        "jscad",
        "content/3d.org",
        5,
        "js"
      );
      const parsed = parseVirtualModuleId(originalId);
      expect(parsed).toEqual({
        pluginName: "jscad",
        orgFilePath: "content/3d.org",
        blockIndex: 5,
        extension: "js",
      });
    });

    it("should be inverse of createVirtualModuleId with named blocks", () => {
      const originalId = createVirtualModuleId(
        "javascript",
        "lib/utils.org",
        0,
        "js",
        "helper"
      );
      const parsed = parseVirtualModuleId(originalId);
      expect(parsed).toEqual({
        pluginName: "javascript",
        orgFilePath: "lib/utils.org",
        blockName: "helper",
        extension: "js",
      });
    });
  });
});
