import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  HydrateRegistry,
  hydrateRegistry,
  sanitizePath,
  generateHydrateEntry,
  type BlockEntry,
} from "./hydrate-registry.ts";

// Mock fs.writeFileSync to avoid actual file writes
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

describe("HydrateRegistry", () => {
  let registry: HydrateRegistry;

  beforeEach(() => {
    registry = new HydrateRegistry();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizePath", () => {
    it("should replace path separators with dashes", () => {
      expect(sanitizePath("content/blog/post.org")).toBe("content-blog-post");
    });

    it("should remove .org extension", () => {
      expect(sanitizePath("index.org")).toBe("index");
    });

    it("should handle nested paths", () => {
      expect(sanitizePath("content/guides/getting-started.org")).toBe(
        "content-guides-getting-started"
      );
    });

    it("should handle paths with leading dots and slashes", () => {
      expect(sanitizePath("./content/post.org")).toBe("content-post");
      expect(sanitizePath("../content/post.org")).toBe("content-post");
    });

    it("should handle backslashes on Windows", () => {
      expect(sanitizePath("content\\blog\\post.org")).toBe("content-blog-post");
    });

    it("should remove multiple consecutive dashes", () => {
      expect(sanitizePath("content//blog//post.org")).toBe("content-blog-post");
    });
  });

  describe("generateHydrateEntry", () => {
    it("should generate correct code for a single block", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "block-content-index-org-8",
          ext: "ts",
          cachePath: "/abs/path/.org-press-cache/content/index/landing-controller.ts",
        },
      ];

      const code = generateHydrateEntry("content/index.org", blocks);

      // Check header comment
      expect(code).toContain("// Auto-generated hydrate entry for content/index.org");

      // Check import statement
      expect(code).toContain(
        'import block_0 from "/abs/path/.org-press-cache/content/index/landing-controller.ts";'
      );

      // Check blocks mapping
      expect(code).toContain('"block-content-index-org-8": block_0,');

      // Check hydrate function exists (async for Promise handling)
      expect(code).toContain("async function hydrate()");
      expect(code).toContain('document.querySelector');
      expect(code).toContain('data-org-block');
    });

    it("should generate correct code for multiple blocks", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "block-content-demo-org-0",
          ext: "tsx",
          cachePath: "/cache/content/demo/block-0.tsx",
        },
        {
          blockId: "block-content-demo-org-1",
          ext: "ts",
          cachePath: "/cache/content/demo/block-1.ts",
        },
        {
          blockId: "block-content-demo-org-2",
          ext: "js",
          cachePath: "/cache/content/demo/block-2.js",
        },
      ];

      const code = generateHydrateEntry("content/demo.org", blocks);

      // Check all imports
      expect(code).toContain('import block_0 from "/cache/content/demo/block-0.tsx";');
      expect(code).toContain('import block_1 from "/cache/content/demo/block-1.ts";');
      expect(code).toContain('import block_2 from "/cache/content/demo/block-2.js";');

      // Check all blocks in mapping
      expect(code).toContain('"block-content-demo-org-0": block_0,');
      expect(code).toContain('"block-content-demo-org-1": block_1,');
      expect(code).toContain('"block-content-demo-org-2": block_2,');
    });

    it("should return minimal code for empty blocks array", () => {
      const code = generateHydrateEntry("content/empty.org", []);

      expect(code).toContain("// Auto-generated hydrate entry for content/empty.org");
      expect(code).toContain("// No blocks to hydrate");
      expect(code).not.toContain("import ");
      expect(code).not.toContain("function hydrate");
    });

    it("should handle both direct function and default exports", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // Check the render function handles different value types
      expect(code).toContain('function render(el, value)');
      expect(code).toContain('if (typeof value === "function")');
      expect(code).toContain('value(el.id)');

      // Check that default exports are extracted correctly
      expect(code).toContain('"default" in mod');

      // Check Promise handling for async IIFE results
      expect(code).toContain('typeof value.then === "function"');
    });

    it("should include DOMContentLoaded handling", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      expect(code).toContain('document.readyState === "loading"');
      expect(code).toContain('document.addEventListener("DOMContentLoaded", hydrate)');
      expect(code).toContain("hydrate();");
    });

    it("should use correct querySelector syntax with single quotes", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // The selector should use string concatenation with the id variable
      expect(code).toContain(`document.querySelector('[data-org-block="' + id + '"]')`);
    });
  });

  describe("addModule", () => {
    it("should register a single block correctly", () => {
      registry.addModule(
        "content/index.org",
        "block-content-index-org-0",
        "tsx",
        "/cache/content/index/block-0.tsx"
      );

      const blocks = registry.getBlocks("content/index.org");
      expect(blocks).toBeDefined();
      expect(blocks).toHaveLength(1);
      expect(blocks![0]).toEqual({
        blockId: "block-content-index-org-0",
        ext: "tsx",
        cachePath: "/cache/content/index/block-0.tsx",
      });
    });

    it("should group multiple blocks for the same page", () => {
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-0",
        "tsx",
        "/cache/content/demo/block-0.tsx"
      );
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-1",
        "ts",
        "/cache/content/demo/block-1.ts"
      );
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-2",
        "js",
        "/cache/content/demo/block-2.js"
      );

      const blocks = registry.getBlocks("content/demo.org");
      expect(blocks).toBeDefined();
      expect(blocks).toHaveLength(3);
      expect(blocks![0].blockId).toBe("block-content-demo-org-0");
      expect(blocks![1].blockId).toBe("block-content-demo-org-1");
      expect(blocks![2].blockId).toBe("block-content-demo-org-2");
    });

    it("should keep blocks from different pages separate", () => {
      registry.addModule(
        "content/page-a.org",
        "block-page-a-0",
        "tsx",
        "/cache/page-a/block-0.tsx"
      );
      registry.addModule(
        "content/page-b.org",
        "block-page-b-0",
        "tsx",
        "/cache/page-b/block-0.tsx"
      );

      expect(registry.getPages()).toHaveLength(2);
      expect(registry.getBlocks("content/page-a.org")).toHaveLength(1);
      expect(registry.getBlocks("content/page-b.org")).toHaveLength(1);
    });
  });

  describe("generateEntries", () => {
    it("should return paths for all pages with blocks", () => {
      registry.addModule(
        "content/index.org",
        "block-0",
        "tsx",
        "/cache/block-0.tsx"
      );
      registry.addModule(
        "content/about.org",
        "block-1",
        "ts",
        "/cache/block-1.ts"
      );

      const paths = registry.generateEntries("/test/cache");

      expect(paths).toHaveLength(2);
      expect(paths).toContain(
        path.join("/test/cache", "hydrate-content-index.ts")
      );
      expect(paths).toContain(
        path.join("/test/cache", "hydrate-content-about.ts")
      );
    });

    it("should call writeFileSync for each entry", () => {
      registry.addModule(
        "content/index.org",
        "block-0",
        "tsx",
        "/cache/block-0.tsx"
      );
      registry.addModule(
        "content/demo.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx"
      );

      registry.generateEntries("/test/cache");

      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when no blocks registered", () => {
      const paths = registry.generateEntries("/test/cache");
      expect(paths).toEqual([]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should generate correct filename for nested paths", () => {
      registry.addModule(
        "content/guides/getting-started.org",
        "block-0",
        "tsx",
        "/cache/block.tsx"
      );

      const paths = registry.generateEntries("/test/cache");

      expect(paths).toHaveLength(1);
      expect(paths[0]).toBe(
        path.join("/test/cache", "hydrate-content-guides-getting-started.ts")
      );
    });
  });

  describe("getEntryForPage", () => {
    it("should return entry filename for registered page", () => {
      registry.addModule(
        "content/index.org",
        "block-0",
        "tsx",
        "/cache/block.tsx"
      );

      const entry = registry.getEntryForPage("content/index.org");
      expect(entry).toBe("hydrate-content-index.ts");
    });

    it("should return undefined for unregistered page", () => {
      const entry = registry.getEntryForPage("content/nonexistent.org");
      expect(entry).toBeUndefined();
    });

    it("should return correct filename for nested path", () => {
      registry.addModule(
        "content/blog/2024/post.org",
        "block-0",
        "tsx",
        "/cache/block.tsx"
      );

      const entry = registry.getEntryForPage("content/blog/2024/post.org");
      expect(entry).toBe("hydrate-content-blog-2024-post.ts");
    });
  });

  describe("clear", () => {
    it("should remove all registered blocks", () => {
      registry.addModule(
        "content/index.org",
        "block-0",
        "tsx",
        "/cache/block-0.tsx"
      );
      registry.addModule(
        "content/about.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx"
      );

      expect(registry.getPages()).toHaveLength(2);

      registry.clear();

      expect(registry.getPages()).toHaveLength(0);
      expect(registry.getBlocks("content/index.org")).toBeUndefined();
      expect(registry.getBlocks("content/about.org")).toBeUndefined();
    });

    it("should allow registering new blocks after clear", () => {
      registry.addModule(
        "content/old.org",
        "block-old",
        "tsx",
        "/cache/old.tsx"
      );
      registry.clear();
      registry.addModule(
        "content/new.org",
        "block-new",
        "tsx",
        "/cache/new.tsx"
      );

      expect(registry.getPages()).toEqual(["content/new.org"]);
    });
  });

  describe("getPages", () => {
    it("should return empty array when no blocks registered", () => {
      expect(registry.getPages()).toEqual([]);
    });

    it("should return all registered page paths", () => {
      registry.addModule(
        "content/page-a.org",
        "block-a",
        "tsx",
        "/cache/a.tsx"
      );
      registry.addModule(
        "content/page-b.org",
        "block-b",
        "tsx",
        "/cache/b.tsx"
      );
      registry.addModule(
        "content/page-c.org",
        "block-c",
        "tsx",
        "/cache/c.tsx"
      );

      const pages = registry.getPages();
      expect(pages).toHaveLength(3);
      expect(pages).toContain("content/page-a.org");
      expect(pages).toContain("content/page-b.org");
      expect(pages).toContain("content/page-c.org");
    });

    it("should not duplicate pages when multiple blocks added", () => {
      registry.addModule(
        "content/index.org",
        "block-0",
        "tsx",
        "/cache/block-0.tsx"
      );
      registry.addModule(
        "content/index.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx"
      );

      expect(registry.getPages()).toEqual(["content/index.org"]);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton hydrateRegistry", () => {
      expect(hydrateRegistry).toBeInstanceOf(HydrateRegistry);
    });
  });
});
