import { describe, it, expect } from "vitest";
import { applyBasePath, buildBlockManifest, type CollectedBlock } from "./build.ts";
import * as path from "node:path";

describe("build", () => {
  describe("applyBasePath", () => {
    it("should apply base path to asset URLs", () => {
      const html = '<link rel="stylesheet" href="/assets/theme-abc123.css">';
      const result = applyBasePath(html, "/org-press/");
      expect(result).toBe(
        '<link rel="stylesheet" href="/org-press/assets/theme-abc123.css">'
      );
    });

    it("should apply base path to script src", () => {
      const html = '<script type="module" src="/assets/hydrate-abc123.js"></script>';
      const result = applyBasePath(html, "/org-press/");
      expect(result).toBe(
        '<script type="module" src="/org-press/assets/hydrate-abc123.js"></script>'
      );
    });

    it("should not double-apply base path", () => {
      const html = '<a href="/org-press/about.html">About</a>';
      const result = applyBasePath(html, "/org-press/");
      expect(result).toBe('<a href="/org-press/about.html">About</a>');
    });

    it("should return unchanged HTML when base is /", () => {
      const html = '<link rel="stylesheet" href="/assets/theme.css">';
      const result = applyBasePath(html, "/");
      expect(result).toBe(html);
    });
  });

  describe("entryFileNames logic", () => {
    // Simulates the entryFileNames logic from build.ts
    function getEntryFileName(
      chunkName: string,
      cacheDir: string = "node_modules/.org-press-cache"
    ): string {
      // entry-client and hydrate go to assets with hash
      if (chunkName === "entry-client" || chunkName === "hydrate") {
        return "assets/[name]-[hash].js";
      }
      // Cache files (block modules) go to cache directory
      if (chunkName) {
        const normalizedCacheDir = cacheDir.replace(/\\/g, "/");
        return `${normalizedCacheDir}/${chunkName}`;
      }
      return "assets/[name]-[hash].js";
    }

    it("should output entry-client to assets directory", () => {
      const result = getEntryFileName("entry-client");
      expect(result).toBe("assets/[name]-[hash].js");
    });

    it("should output hydrate to assets directory", () => {
      const result = getEntryFileName("hydrate");
      expect(result).toBe("assets/[name]-[hash].js");
    });

    it("should output cache files to cache directory", () => {
      const result = getEntryFileName("my-block");
      expect(result).toBe("node_modules/.org-press-cache/my-block");
    });

    it("should output theme to cache directory", () => {
      const result = getEntryFileName("theme");
      expect(result).toBe("node_modules/.org-press-cache/theme");
    });
  });

  describe("buildBlockManifest", () => {
    // Helper to create a collected block with absolute path
    function createBlock(
      id: string,
      relativeCachePath: string,
      language: string = "typescript"
    ): CollectedBlock {
      return {
        id,
        containerId: `org-block-0-result`,
        cachePath: path.join(process.cwd(), relativeCachePath),
        language,
      };
    }

    it("should build manifest from collected blocks with direct path match", () => {
      const blocks: CollectedBlock[] = [
        createBlock(
          "block-content-demo-org-0",
          "node_modules/.org-press-cache/content/demo/my-block.ts"
        ),
      ];

      const viteManifest = {
        "node_modules/.org-press-cache/content/demo/my-block.ts": {
          file: "node_modules/.org-press-cache/content/demo/my-block.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/");

      expect(result).toEqual({
        "block-content-demo-org-0": {
          src: "/node_modules/.org-press-cache/content/demo/my-block.js",
        },
      });
    });

    it("should apply base path to manifest URLs", () => {
      const blocks: CollectedBlock[] = [
        createBlock(
          "block-content-demo-org-0",
          "node_modules/.org-press-cache/content/demo/my-block.ts"
        ),
      ];

      const viteManifest = {
        "node_modules/.org-press-cache/content/demo/my-block.ts": {
          file: "node_modules/.org-press-cache/content/demo/my-block.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/org-press/");

      expect(result).toEqual({
        "block-content-demo-org-0": {
          src: "/org-press/node_modules/.org-press-cache/content/demo/my-block.js",
        },
      });
    });

    it("should match by filename as fallback", () => {
      const blocks: CollectedBlock[] = [
        createBlock(
          "block-content-demo-org-0",
          "node_modules/.org-press-cache/content/demo/my-block.ts"
        ),
      ];

      // Vite manifest might have slightly different path format
      const viteManifest = {
        "some/other/path/my-block.ts": {
          file: "assets/my-block-abc123.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/");

      expect(result).toEqual({
        "block-content-demo-org-0": {
          src: "/assets/my-block-abc123.js",
        },
      });
    });

    it("should handle multiple blocks", () => {
      const blocks: CollectedBlock[] = [
        createBlock(
          "block-content-plugins-jscad-org-2",
          "node_modules/.org-press-cache/content/plugins/jscad/cube.ts"
        ),
        createBlock(
          "block-content-plugins-jscad-org-3",
          "node_modules/.org-press-cache/content/plugins/jscad/sphere.ts"
        ),
      ];

      const viteManifest = {
        "node_modules/.org-press-cache/content/plugins/jscad/cube.ts": {
          file: "node_modules/.org-press-cache/content/plugins/jscad/cube.js",
        },
        "node_modules/.org-press-cache/content/plugins/jscad/sphere.ts": {
          file: "node_modules/.org-press-cache/content/plugins/jscad/sphere.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/");

      expect(result).toEqual({
        "block-content-plugins-jscad-org-2": {
          src: "/node_modules/.org-press-cache/content/plugins/jscad/cube.js",
        },
        "block-content-plugins-jscad-org-3": {
          src: "/node_modules/.org-press-cache/content/plugins/jscad/sphere.js",
        },
      });
    });

    it("should return empty manifest for empty blocks array", () => {
      const result = buildBlockManifest([], {}, "/");
      expect(result).toEqual({});
    });

    it("should skip blocks not found in manifest", () => {
      const blocks: CollectedBlock[] = [
        createBlock(
          "block-content-demo-org-0",
          "node_modules/.org-press-cache/content/demo/missing.ts"
        ),
      ];

      const viteManifest = {
        "node_modules/.org-press-cache/content/demo/other.ts": {
          file: "assets/other.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/");

      expect(result).toEqual({});
    });

    it("should handle blocks with named exports", () => {
      const blocks: CollectedBlock[] = [
        {
          id: "block-content-demo-org-0",
          containerId: "org-block-0-result",
          cachePath: path.join(
            process.cwd(),
            "node_modules/.org-press-cache/content/demo/my-component.tsx"
          ),
          name: "MyComponent",
          language: "tsx",
        },
      ];

      const viteManifest = {
        "node_modules/.org-press-cache/content/demo/my-component.tsx": {
          file: "assets/my-component-xyz789.js",
        },
      };

      const result = buildBlockManifest(blocks, viteManifest, "/");

      expect(result).toEqual({
        "block-content-demo-org-0": {
          src: "/assets/my-component-xyz789.js",
        },
      });
    });
  });
});
