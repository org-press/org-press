import { describe, it, expect } from "vitest";
import {
  builtinPlugins,
  allBuiltinPlugins,
  cssPlugin,
  cssInlinePlugin,
  cssScopedPlugin,
  javascriptPlugin,
  javascriptDirectPlugin,
  typescriptPlugin,
  tsxPlugin,
  jsxPlugin,
  serverPlugin,
  serverOnlyPlugin,
  apiPlugin,
  fmtPlugin,
  lintPlugin,
  typeCheckPlugin,
  previewPlugin,
  sourceOnlyPlugin,
  silentPlugin,
  rawPlugin,
} from "./index.ts";

describe("builtin plugins", () => {
  describe("exports", () => {
    it("should export main plugins array", () => {
      expect(builtinPlugins).toBeInstanceOf(Array);
      // 4 mode plugins + 4 language plugins
      expect(builtinPlugins.length).toBe(8);
    });

    it("should export all plugins array", () => {
      expect(allBuiltinPlugins).toBeInstanceOf(Array);
      // 14 previous + 4 mode plugins = 18
      expect(allBuiltinPlugins.length).toBe(18);
    });

    it("should export individual plugins", () => {
      expect(cssPlugin).toBeDefined();
      expect(cssInlinePlugin).toBeDefined();
      expect(cssScopedPlugin).toBeDefined();
      expect(javascriptPlugin).toBeDefined();
      expect(javascriptDirectPlugin).toBeDefined();
      expect(typescriptPlugin).toBeDefined();
      expect(tsxPlugin).toBeDefined();
      expect(jsxPlugin).toBeDefined();
      expect(serverPlugin).toBeDefined();
      expect(serverOnlyPlugin).toBeDefined();
      expect(apiPlugin).toBeDefined();
      expect(fmtPlugin).toBeDefined();
      expect(lintPlugin).toBeDefined();
      expect(typeCheckPlugin).toBeDefined();
    });
  });

  describe("plugin structure", () => {
    it("should have correct properties on cssPlugin", () => {
      expect(cssPlugin.name).toBe("css");
      expect(cssPlugin.defaultExtension).toBe("css");
      expect(cssPlugin.languages).toEqual(["css", "scss", "sass", "less"]);
      expect(cssPlugin.priority).toBe(10);
      expect(cssPlugin.transform).toBeDefined();
    });

    it("should have correct properties on javascriptPlugin", () => {
      expect(javascriptPlugin.name).toBe("javascript");
      expect(javascriptPlugin.defaultExtension).toBe("js");
      // JavaScript plugin now only handles .js files
      expect(javascriptPlugin.languages).toEqual(["javascript", "js"]);
      expect(javascriptPlugin.priority).toBe(10);
      expect(javascriptPlugin.transform).toBeDefined();
    });

    it("should have correct properties on typescriptPlugin", () => {
      expect(typescriptPlugin.name).toBe("typescript");
      expect(typescriptPlugin.defaultExtension).toBe("ts"); // Key: Vite transpiles .ts
      expect(typescriptPlugin.languages).toEqual(["typescript", "ts"]);
      expect(typescriptPlugin.priority).toBe(10);
      expect(typescriptPlugin.transform).toBeDefined();
    });

    it("should have correct properties on tsxPlugin", () => {
      expect(tsxPlugin.name).toBe("tsx");
      expect(tsxPlugin.defaultExtension).toBe("tsx"); // Key: Vite transpiles .tsx
      expect(tsxPlugin.languages).toEqual(["tsx"]);
      expect(tsxPlugin.priority).toBe(10);
      expect(tsxPlugin.transform).toBeDefined();
    });

    it("should have correct properties on jsxPlugin", () => {
      expect(jsxPlugin.name).toBe("jsx");
      expect(jsxPlugin.defaultExtension).toBe("jsx"); // Key: Vite transpiles .jsx
      expect(jsxPlugin.languages).toEqual(["jsx"]);
      expect(jsxPlugin.priority).toBe(10);
      expect(jsxPlugin.transform).toBeDefined();
    });

    it("should have correct properties on serverPlugin", () => {
      expect(serverPlugin.name).toBe("server");
      expect(serverPlugin.defaultExtension).toBe("js");
      // Note: serverPlugin intentionally has no languages array
      // It should only match via :use server (custom matches function)
      // Having languages would cause it to match ALL JS blocks before other plugins
      expect(serverPlugin.languages).toBeUndefined();
      expect(serverPlugin.priority).toBe(15); // Higher than javascript
      expect(serverPlugin.matches).toBeDefined();
      expect(serverPlugin.transform).toBeDefined();
      expect(serverPlugin.onServer).toBeDefined();
    });
  });

  describe("plugin ordering", () => {
    it("should have mode and language plugins in builtinPlugins", () => {
      // Mode plugins (high priority)
      expect(builtinPlugins).toContain(previewPlugin);
      expect(builtinPlugins).toContain(sourceOnlyPlugin);
      expect(builtinPlugins).toContain(silentPlugin);
      expect(builtinPlugins).toContain(rawPlugin);
      // Language plugins
      expect(builtinPlugins).toContain(javascriptPlugin);
      expect(builtinPlugins).toContain(typescriptPlugin);
      expect(builtinPlugins).toContain(tsxPlugin);
      expect(builtinPlugins).toContain(jsxPlugin);
      expect(builtinPlugins.length).toBe(8);
    });

    it("should include all plugins in allBuiltinPlugins", () => {
      // Mode plugins
      expect(allBuiltinPlugins).toContain(previewPlugin);
      expect(allBuiltinPlugins).toContain(sourceOnlyPlugin);
      expect(allBuiltinPlugins).toContain(silentPlugin);
      expect(allBuiltinPlugins).toContain(rawPlugin);
      // Other plugins
      expect(allBuiltinPlugins).toContain(apiPlugin);
      expect(allBuiltinPlugins).toContain(serverPlugin);
      expect(allBuiltinPlugins).toContain(javascriptPlugin);
      expect(allBuiltinPlugins).toContain(typescriptPlugin);
      expect(allBuiltinPlugins).toContain(tsxPlugin);
      expect(allBuiltinPlugins).toContain(jsxPlugin);
      expect(allBuiltinPlugins).toContain(cssPlugin);
      expect(allBuiltinPlugins).toContain(cssInlinePlugin);
      expect(allBuiltinPlugins).toContain(cssScopedPlugin);
      expect(allBuiltinPlugins).toContain(javascriptDirectPlugin);
      expect(allBuiltinPlugins).toContain(serverOnlyPlugin);
      expect(allBuiltinPlugins).toContain(fmtPlugin);
      expect(allBuiltinPlugins).toContain(lintPlugin);
      expect(allBuiltinPlugins).toContain(typeCheckPlugin);
    });
  });

  describe("plugin matching", () => {
    it("should match serverPlugin with :use server parameter", async () => {
      const block = {
        value: 'console.log("test")',
        language: "javascript",
        meta: ":use server",
      };

      const matches = serverPlugin.matches?.(block);
      expect(matches).toBe(true);
    });

    it("should not match serverPlugin without :use server", async () => {
      const block = {
        value: 'console.log("test")',
        language: "javascript",
        meta: "",
      };

      const matches = serverPlugin.matches?.(block);
      expect(matches).toBe(false);
    });

    it("should not match serverPlugin with non-JS language", async () => {
      const block = {
        value: 'print("test")',
        language: "python",
        meta: ":use server",
      };

      const matches = serverPlugin.matches?.(block);
      expect(matches).toBe(false);
    });
  });

  describe("plugin transformations", () => {
    const mockContext = {
      orgFilePath: "test.org",
      plugins: [],
      config: {} as any,
      cacheDir: "/cache",
      base: "/",
      contentDir: "/content",
      outDir: "/out",
      blockIndex: 0,
      parameters: {},
    };

    it("should transform CSS code", async () => {
      const block = {
        value: ".test { color: red; }",
        language: "css",
        meta: "",
      };

      const result = await cssPlugin.transform?.(block, mockContext);
      expect(result?.code).toBe(".test { color: red; }");
    });

    it("should transform JavaScript code with :use sourceOnly using sourceOnlyPlugin", async () => {
      const block = {
        value: 'console.log("hello");',
        language: "javascript",
        meta: ":use sourceOnly",
      };

      // Mode handling is now done by sourceOnlyPlugin, not language plugins
      const result = await sourceOnlyPlugin.transform?.(block, mockContext);
      // sourceOnlyPlugin exports code as a JSON string for display (not execution)
      expect(result?.code).toContain("export default");
      expect(result?.code).toContain("Source display only");
      // The code is JSON-stringified, so quotes are escaped
      expect(result?.code).toContain("console.log");
    });

    it("should transform JavaScript code with :use preview", async () => {
      const block = {
        value: 'console.log("hello");',
        language: "javascript",
        meta: ":use preview",
      };

      const result = await javascriptPlugin.transform?.(block, mockContext);
      // JavaScript plugin returns raw code - wrapping is handled by other layers
      expect(result?.code).toContain('console.log("hello");');
    });

    it("should transform TypeScript code (returns raw TS for Vite to handle)", async () => {
      const block = {
        value: 'const x: number = 42;',
        language: "typescript",
        meta: ":use preview",
      };

      const result = await typescriptPlugin.transform?.(block, mockContext);
      // TypeScript plugin returns raw TypeScript - Vite handles transpilation
      expect(result?.code).toContain('const x: number = 42;');
    });

    it("should transform TSX code (returns raw TSX for Vite to handle)", async () => {
      const block = {
        value: 'const App: React.FC = () => <div>Hello</div>;',
        language: "tsx",
        meta: ":use preview",
      };

      const result = await tsxPlugin.transform?.(block, mockContext);
      // TSX plugin returns raw TSX - Vite handles transpilation
      expect(result?.code).toContain('<div>Hello</div>');
    });

    it("should transform JSX code (returns raw JSX for Vite to handle)", async () => {
      const block = {
        value: 'const App = () => <div>Hello</div>;',
        language: "jsx",
        meta: ":use preview",
      };

      const result = await jsxPlugin.transform?.(block, mockContext);
      // JSX plugin returns raw JSX - Vite handles transpilation
      expect(result?.code).toContain('<div>Hello</div>');
    });

    it("should transform server block for client (empty code)", async () => {
      const block = {
        value: 'const pages = content.getContentPages();',
        language: "javascript",
        meta: ":use server",
      };

      const result = await serverPlugin.transform?.(block, mockContext);
      expect(result?.code).toContain("Server-side execution");
    });

    it("should transform server block for server (with contentHelpers)", async () => {
      const block = {
        value: 'return 42',
        language: "javascript",
        meta: ":use server",
      };

      // Server plugin now requires contentHelpers in context
      const contextWithHelpers = {
        ...mockContext,
        contentHelpers: {
          getContentPages: async () => [],
          getContentPagesFromDirectory: async () => [],
          renderPageList: () => "<ul></ul>",
        },
      };

      const result = await serverPlugin.onServer?.(block, contextWithHelpers);
      // New server plugin executes and returns display code
      expect(result?.executeOnServer).toBe(true);
      // The code should contain display logic for the result
      expect(result?.code).toBeDefined();
    });
  });

  describe("Vite transpilation delegation", () => {
    // These tests verify that each plugin uses the correct file extension
    // which is critical for Vite's automatic transpilation

    it("should use .js extension for JavaScript (no transpilation needed)", () => {
      expect(javascriptPlugin.defaultExtension).toBe("js");
    });

    it("should use .ts extension for TypeScript (Vite transpiles)", () => {
      expect(typescriptPlugin.defaultExtension).toBe("ts");
    });

    it("should use .tsx extension for TSX (Vite transpiles)", () => {
      expect(tsxPlugin.defaultExtension).toBe("tsx");
    });

    it("should use .jsx extension for JSX (Vite transpiles)", () => {
      expect(jsxPlugin.defaultExtension).toBe("jsx");
    });
  });
});
