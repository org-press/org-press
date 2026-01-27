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
          virtualModuleId: "virtual:org-press:block:preview:content/index.org:8.ts",
        },
      ];

      const code = generateHydrateEntry("content/index.org", blocks);

      // Check header comment
      expect(code).toContain("// Auto-generated hydrate entry for content/index.org");

      // Check runtime import
      expect(code).toContain('import { initHydration } from "org-press/client/hydrate-runtime"');

      // Check import statement uses virtual module ID with namespace import
      expect(code).toContain(
        'import * as Block0 from "virtual:org-press:block:preview:content/index.org:8.ts";'
      );

      // Check blocks mapping includes module reference
      expect(code).toContain('"block-content-index-org-8": { module: Block0');

      // Check initHydration is called
      expect(code).toContain("initHydration(blocks)");
    });

    it("should generate correct code for multiple blocks", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "block-content-demo-org-0",
          ext: "tsx",
          cachePath: "/cache/content/demo/block-0.tsx",
          virtualModuleId: "virtual:org-press:block:preview:content/demo.org:0.tsx",
        },
        {
          blockId: "block-content-demo-org-1",
          ext: "ts",
          cachePath: "/cache/content/demo/block-1.ts",
          virtualModuleId: "virtual:org-press:block:preview:content/demo.org:1.ts",
        },
        {
          blockId: "block-content-demo-org-2",
          ext: "js",
          cachePath: "/cache/content/demo/block-2.js",
          virtualModuleId: "virtual:org-press:block:preview:content/demo.org:2.js",
        },
      ];

      const code = generateHydrateEntry("content/demo.org", blocks);

      // Check all imports use virtual module IDs
      expect(code).toContain('import * as Block0 from "virtual:org-press:block:preview:content/demo.org:0.tsx";');
      expect(code).toContain('import * as Block1 from "virtual:org-press:block:preview:content/demo.org:1.ts";');
      expect(code).toContain('import * as Block2 from "virtual:org-press:block:preview:content/demo.org:2.js";');

      // Check all blocks in mapping
      expect(code).toContain('"block-content-demo-org-0": { module: Block0');
      expect(code).toContain('"block-content-demo-org-1": { module: Block1');
      expect(code).toContain('"block-content-demo-org-2": { module: Block2');
    });

    it("should return minimal code for empty blocks array", () => {
      const code = generateHydrateEntry("content/empty.org", []);

      expect(code).toContain("// Auto-generated hydrate entry for content/empty.org");
      expect(code).toContain("// No blocks to hydrate");
      expect(code).not.toContain("import ");
      expect(code).not.toContain("function hydrate");
    });

    it("should import runtime and set correct isReact flag", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
          virtualModuleId: "virtual:org-press:block:preview:test.org:0.ts",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // Runtime is imported instead of inline
      expect(code).toContain('import { initHydration } from "org-press/client/hydrate-runtime"');

      // Check isReact flag in blocks mapping (determined by file extension)
      expect(code).toContain("isReact: false"); // .ts file should be non-React

      // Hydration logic is now in the runtime module, not generated
      expect(code).toContain("initHydration(blocks)");
    });

    it("should set isReact: true for tsx/jsx blocks and include modeName", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "react-block",
          ext: "tsx",
          cachePath: "/test/block.tsx",
          virtualModuleId: "virtual:org-press:block:preview:test.org:0.tsx",
          modeName: "react",
        },
        {
          blockId: "jsx-block",
          ext: "jsx",
          cachePath: "/test/block.jsx",
          virtualModuleId: "virtual:org-press:block:preview:test.org:1.jsx",
          modeName: "react",
        },
        {
          blockId: "plain-block",
          ext: "ts",
          cachePath: "/test/block.ts",
          virtualModuleId: "virtual:org-press:block:preview:test.org:2.ts",
          modeName: "dom",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // TSX and JSX should have isReact: true and include modeName
      expect(code).toContain('"react-block": { module: Block0, ext: "tsx", isReact: true, modeName: "react" }');
      expect(code).toContain('"jsx-block": { module: Block1, ext: "jsx", isReact: true, modeName: "react" }');
      // TS should have isReact: false
      expect(code).toContain('"plain-block": { module: Block2, ext: "ts", isReact: false, modeName: "dom" }');
    });

    it("should call initHydration with blocks registry", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
          virtualModuleId: "virtual:org-press:block:preview:test.org:0.ts",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // DOMContentLoaded handling is now in the runtime
      expect(code).toContain("initHydration(blocks)");
    });

    it("should fall back to cache path when virtualModuleId is not provided", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "test-block",
          ext: "ts",
          cachePath: "/test/block.ts",
          virtualModuleId: "", // Empty virtualModuleId
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // Should use cache path as fallback
      expect(code).toContain('import * as Block0 from "/test/block.ts";');
    });
  });

  describe("addModule", () => {
    it("should register a single block correctly", () => {
      registry.addModule(
        "content/index.org",
        "block-content-index-org-0",
        "tsx",
        "/cache/content/index/block-0.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
      );

      const blocks = registry.getBlocks("content/index.org");
      expect(blocks).toBeDefined();
      expect(blocks).toHaveLength(1);
      expect(blocks![0]).toEqual({
        blockId: "block-content-index-org-0",
        ext: "tsx",
        cachePath: "/cache/content/index/block-0.tsx",
        virtualModuleId: "virtual:org-press:block:preview:content/index.org:0.tsx",
      });
    });

    it("should group multiple blocks for the same page", () => {
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-0",
        "tsx",
        "/cache/content/demo/block-0.tsx",
        "virtual:org-press:block:preview:content/demo.org:0.tsx"
      );
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-1",
        "ts",
        "/cache/content/demo/block-1.ts",
        "virtual:org-press:block:preview:content/demo.org:1.ts"
      );
      registry.addModule(
        "content/demo.org",
        "block-content-demo-org-2",
        "js",
        "/cache/content/demo/block-2.js",
        "virtual:org-press:block:preview:content/demo.org:2.js"
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
        "/cache/page-a/block-0.tsx",
        "virtual:org-press:block:preview:content/page-a.org:0.tsx"
      );
      registry.addModule(
        "content/page-b.org",
        "block-page-b-0",
        "tsx",
        "/cache/page-b/block-0.tsx",
        "virtual:org-press:block:preview:content/page-b.org:0.tsx"
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
        "/cache/block-0.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
      );
      registry.addModule(
        "content/about.org",
        "block-1",
        "ts",
        "/cache/block-1.ts",
        "virtual:org-press:block:preview:content/about.org:0.ts"
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
        "/cache/block-0.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
      );
      registry.addModule(
        "content/demo.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx",
        "virtual:org-press:block:preview:content/demo.org:0.tsx"
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
        "/cache/block.tsx",
        "virtual:org-press:block:preview:content/guides/getting-started.org:0.tsx"
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
        "/cache/block.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
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
        "/cache/block.tsx",
        "virtual:org-press:block:preview:content/blog/2024/post.org:0.tsx"
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
        "/cache/block-0.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
      );
      registry.addModule(
        "content/about.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx",
        "virtual:org-press:block:preview:content/about.org:0.tsx"
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
        "/cache/old.tsx",
        "virtual:org-press:block:preview:content/old.org:0.tsx"
      );
      registry.clear();
      registry.addModule(
        "content/new.org",
        "block-new",
        "tsx",
        "/cache/new.tsx",
        "virtual:org-press:block:preview:content/new.org:0.tsx"
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
        "/cache/a.tsx",
        "virtual:org-press:block:preview:content/page-a.org:0.tsx"
      );
      registry.addModule(
        "content/page-b.org",
        "block-b",
        "tsx",
        "/cache/b.tsx",
        "virtual:org-press:block:preview:content/page-b.org:0.tsx"
      );
      registry.addModule(
        "content/page-c.org",
        "block-c",
        "tsx",
        "/cache/c.tsx",
        "virtual:org-press:block:preview:content/page-c.org:0.tsx"
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
        "/cache/block-0.tsx",
        "virtual:org-press:block:preview:content/index.org:0.tsx"
      );
      registry.addModule(
        "content/index.org",
        "block-1",
        "tsx",
        "/cache/block-1.tsx",
        "virtual:org-press:block:preview:content/index.org:1.tsx"
      );

      expect(registry.getPages()).toEqual(["content/index.org"]);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton hydrateRegistry", () => {
      expect(hydrateRegistry).toBeInstanceOf(HydrateRegistry);
    });
  });

  describe("generated code structure", () => {
    it("should generate minimal entry that delegates to runtime", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "block-0",
          ext: "tsx",
          cachePath: "/cache/block-0.tsx",
          virtualModuleId: "virtual:org-press:block:preview:test.org:0.tsx",
          modeName: "dom",
        },
        {
          blockId: "block-1",
          ext: "ts",
          cachePath: "/cache/block-1.ts",
          virtualModuleId: "virtual:org-press:block:preview:test.org:1.ts",
          modeName: "dom",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // Should import runtime
      expect(code).toContain('import { initHydration } from "org-press/client/hydrate-runtime"');

      // Should import blocks
      expect(code).toContain("import * as Block0");
      expect(code).toContain("import * as Block1");

      // Should define blocks registry
      expect(code).toContain("const blocks = {");
      expect(code).toContain('"block-0"');
      expect(code).toContain('"block-1"');

      // Should call initHydration
      expect(code).toContain("initHydration(blocks)");

      // Should NOT contain inline function definitions (those are in runtime)
      expect(code).not.toContain("function renderResult");
      expect(code).not.toContain("function hydrate()");
      expect(code).not.toContain("async function");
    });

    it("should set correct metadata in blocks registry", () => {
      const blocks: BlockEntry[] = [
        {
          blockId: "react-block",
          ext: "tsx",
          cachePath: "/cache/react.tsx",
          virtualModuleId: "virtual:test:react.tsx",
          modeName: "react",
        },
        {
          blockId: "plain-block",
          ext: "js",
          cachePath: "/cache/plain.js",
          virtualModuleId: "virtual:test:plain.js",
          modeName: "dom",
        },
      ];

      const code = generateHydrateEntry("test.org", blocks);

      // TSX should have isReact: true
      expect(code).toContain('"react-block": { module: Block0, ext: "tsx", isReact: true, modeName: "react" }');

      // JS should have isReact: false
      expect(code).toContain('"plain-block": { module: Block1, ext: "js", isReact: false, modeName: "dom" }');
    });
  });
});
