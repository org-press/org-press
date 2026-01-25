import { describe, it, expect } from "vitest";
import type { ViteDevServer, ModuleNode } from "vite";
import {
  collectCssFromModuleGraph,
  generateCssLinkTags,
  isCssFile,
} from "./css-collector.ts";

describe("CSS Collector", () => {
  describe("isCssFile", () => {
    it("should return true for .css files", () => {
      expect(isCssFile("style.css")).toBe(true);
      expect(isCssFile("/path/to/theme.css")).toBe(true);
      expect(isCssFile("./relative/path.css")).toBe(true);
    });

    it("should return true for .CSS files (case insensitive)", () => {
      expect(isCssFile("style.CSS")).toBe(true);
      expect(isCssFile("STYLE.CSS")).toBe(true);
    });

    it("should return false for non-CSS files", () => {
      expect(isCssFile("style.scss")).toBe(false);
      expect(isCssFile("style.less")).toBe(false);
      expect(isCssFile("component.tsx")).toBe(false);
      expect(isCssFile("module.js")).toBe(false);
      expect(isCssFile("style.css.map")).toBe(false);
    });

    it("should return false for paths containing .css but not ending with it", () => {
      expect(isCssFile("/path/css/file.js")).toBe(false);
      expect(isCssFile("style.css.js")).toBe(false);
    });
  });

  describe("generateCssLinkTags", () => {
    it("should generate link tags for CSS URLs", () => {
      const cssUrls = ["/@fs/path/to/style.css"];
      const result = generateCssLinkTags(cssUrls);

      expect(result).toBe('<link rel="stylesheet" href="/@fs/path/to/style.css">');
    });

    it("should generate multiple link tags separated by newlines", () => {
      const cssUrls = [
        "/@fs/path/to/style1.css",
        "/@fs/path/to/style2.css",
      ];
      const result = generateCssLinkTags(cssUrls);

      expect(result).toBe(
        '<link rel="stylesheet" href="/@fs/path/to/style1.css">\n  ' +
        '<link rel="stylesheet" href="/@fs/path/to/style2.css">'
      );
    });

    it("should return empty string for empty array", () => {
      const result = generateCssLinkTags([]);
      expect(result).toBe("");
    });

    it("should handle URLs with query strings", () => {
      const cssUrls = ["/@fs/path/to/style.css?v=123"];
      const result = generateCssLinkTags(cssUrls);

      expect(result).toBe('<link rel="stylesheet" href="/@fs/path/to/style.css?v=123">');
    });
  });

  describe("collectCssFromModuleGraph", () => {
    /**
     * Create a mock ModuleNode
     */
    function createMockModuleNode(
      id: string,
      importedModules: ModuleNode[] = []
    ): ModuleNode {
      return {
        id,
        url: id.startsWith("/") ? `/@fs${id}` : id,
        importedModules: new Set(importedModules),
        importers: new Set(),
        ssrImportedModules: new Set(),
        clientImportedModules: new Set(),
        acceptedHmrDeps: new Set(),
        acceptedHmrExports: null,
        importedBindings: null,
        transformResult: null,
        ssrTransformResult: null,
        ssrModule: null,
        ssrError: null,
        lastHMRTimestamp: 0,
        lastInvalidationTimestamp: 0,
        lastHMRInvalidationReceived: false,
        file: id,
        type: "js",
      } as ModuleNode;
    }

    /**
     * Create a mock ViteDevServer with a module graph
     */
    function createMockServer(
      modules: Map<string, ModuleNode>
    ): ViteDevServer {
      return {
        moduleGraph: {
          getModuleById: (id: string) => modules.get(id) || null,
          getModuleByUrl: (url: string) => {
            for (const mod of modules.values()) {
              if (mod.url === url) return mod;
            }
            return null;
          },
        },
      } as ViteDevServer;
    }

    it("should collect CSS from direct imports", () => {
      const cssModule = createMockModuleNode("/path/to/style.css");
      const entryModule = createMockModuleNode("/path/to/theme.tsx", [cssModule]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/style.css", cssModule);

      const server = createMockServer(modules);
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      expect(result).toContain("/@fs/path/to/style.css");
    });

    it("should collect CSS from nested imports", () => {
      const cssModule = createMockModuleNode("/path/to/style.css");
      const componentModule = createMockModuleNode("/path/to/component.tsx", [cssModule]);
      const entryModule = createMockModuleNode("/path/to/theme.tsx", [componentModule]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/component.tsx", componentModule);
      modules.set("/path/to/style.css", cssModule);

      const server = createMockServer(modules);
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      expect(result).toContain("/@fs/path/to/style.css");
    });

    it("should not duplicate CSS URLs", () => {
      const cssModule = createMockModuleNode("/path/to/style.css");
      const component1 = createMockModuleNode("/path/to/component1.tsx", [cssModule]);
      const component2 = createMockModuleNode("/path/to/component2.tsx", [cssModule]);
      const entryModule = createMockModuleNode("/path/to/theme.tsx", [component1, component2]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/component1.tsx", component1);
      modules.set("/path/to/component2.tsx", component2);
      modules.set("/path/to/style.css", cssModule);

      const server = createMockServer(modules);
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      const cssOccurrences = result.filter((url) => url.includes("style.css"));
      expect(cssOccurrences.length).toBe(1);
    });

    it("should handle circular dependencies", () => {
      const cssModule = createMockModuleNode("/path/to/style.css");
      const component1 = createMockModuleNode("/path/to/component1.tsx", [cssModule]);
      const component2 = createMockModuleNode("/path/to/component2.tsx", [cssModule]);

      // Create circular dependency
      (component1.importedModules as Set<ModuleNode>).add(component2);
      (component2.importedModules as Set<ModuleNode>).add(component1);

      const entryModule = createMockModuleNode("/path/to/theme.tsx", [component1]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/component1.tsx", component1);
      modules.set("/path/to/component2.tsx", component2);
      modules.set("/path/to/style.css", cssModule);

      const server = createMockServer(modules);

      // Should not hang due to circular dependency
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      expect(result).toContain("/@fs/path/to/style.css");
    });

    it("should return empty array when module not found", () => {
      const server = createMockServer(new Map());
      const result = collectCssFromModuleGraph(server, "/nonexistent/module.tsx");

      expect(result).toEqual([]);
    });

    it("should return empty array when no CSS imports", () => {
      const jsModule = createMockModuleNode("/path/to/utils.js");
      const entryModule = createMockModuleNode("/path/to/theme.tsx", [jsModule]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/utils.js", jsModule);

      const server = createMockServer(modules);
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      expect(result).toEqual([]);
    });

    it("should collect multiple CSS files", () => {
      const css1 = createMockModuleNode("/path/to/style1.css");
      const css2 = createMockModuleNode("/path/to/style2.css");
      const css3 = createMockModuleNode("/path/to/style3.css");
      const entryModule = createMockModuleNode("/path/to/theme.tsx", [css1, css2, css3]);

      const modules = new Map<string, ModuleNode>();
      modules.set("/path/to/theme.tsx", entryModule);
      modules.set("/path/to/style1.css", css1);
      modules.set("/path/to/style2.css", css2);
      modules.set("/path/to/style3.css", css3);

      const server = createMockServer(modules);
      const result = collectCssFromModuleGraph(server, "/path/to/theme.tsx");

      expect(result.length).toBe(3);
      expect(result).toContain("/@fs/path/to/style1.css");
      expect(result).toContain("/@fs/path/to/style2.css");
      expect(result).toContain("/@fs/path/to/style3.css");
    });
  });
});
