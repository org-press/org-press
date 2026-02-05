import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createServerPlugin,
  serverPlugin,
  serverOnlyPlugin,
} from "./server.ts";
import { createServerHandler } from "../handler-factory.ts";
import { createDefaultJavaScriptHandler } from "./javascript-handler.ts";
import type { CodeBlock, TransformContext } from "../types.ts";

// Mock content helpers
const mockContentHelpers = {
  getContentPages: vi.fn().mockResolvedValue([]),
  getContentPagesFromDirectory: vi.fn().mockResolvedValue([]),
  renderPageList: vi.fn().mockReturnValue("<ul></ul>"),
};

// Mock transform context
function createMockContext(overrides: Partial<TransformContext> = {}): TransformContext {
  return {
    orgFilePath: "content/test.org",
    blockIndex: 0,
    parameters: {},
    plugins: [],
    config: {},
    cacheDir: "node_modules/.org-press-cache",
    base: "/",
    contentDir: "content",
    outDir: "dist/static",
    contentHelpers: mockContentHelpers,
    ...overrides,
  };
}

describe("Server Plugin Factory", () => {
  it("should create plugin with custom handlers", () => {
    const handler = createDefaultJavaScriptHandler();
    const plugin = createServerPlugin([handler]);

    expect(plugin.name).toBe("server");
    expect(plugin.priority).toBe(15);
    expect(plugin.defaultExtension).toBe("js");
  });

  it("should create plugin with createServerHandler", () => {
    const handler = createServerHandler(
      (params, block) => params.use === "server" && block.language === "python",
      {
        async onServer(code, ctx) {
          return "Python result";
        },
      }
    );
    const plugin = createServerPlugin([handler]);

    expect(plugin.name).toBe("server");
    expect(typeof plugin.matches).toBe("function");
    expect(typeof plugin.onServer).toBe("function");
  });

  it("should match blocks when handler matches", () => {
    const handler = createServerHandler(
      (params, block) => params.use === "server",
      { async onServer(code) { return "result"; } }
    );
    const plugin = createServerPlugin([handler]);
    const block: CodeBlock = {
      meta: ":use server",
      language: "javascript",
      value: "return 42",
    };

    expect(plugin.matches!(block)).toBe(true);
  });

  it("should not match blocks when no handler matches", () => {
    const handler = createServerHandler(
      (params) => params.engine === "deno",
      { async onServer(code) { return "result"; } }
    );
    const plugin = createServerPlugin([handler]);
    const block: CodeBlock = {
      meta: ":use server",
      language: "javascript",
      value: "return 42",
    };

    expect(plugin.matches!(block)).toBe(false);
  });

  it("should match with multiple handlers (first match wins)", () => {
    const denoHandler = createServerHandler(
      (params, block) => params.engine === "deno" && block.language === "javascript",
      { async onServer(code) { return "deno result"; } }
    );
    const jsHandler = createDefaultJavaScriptHandler();

    const plugin = createServerPlugin([denoHandler, jsHandler]);

    // Should match :use server (jsHandler)
    const block1: CodeBlock = {
      meta: ":use server",
      language: "javascript",
      value: "",
    };
    expect(plugin.matches!(block1)).toBe(true);

    // Should match custom handler for deno runtime
    const block2: CodeBlock = {
      meta: ":use server :engine deno",
      language: "javascript",
      value: "",
    };
    expect(plugin.matches!(block2)).toBe(true);
  });
});

describe("JavaScript Handler", () => {
  it("should match JavaScript/TypeScript with :use server", () => {
    const handler = createDefaultJavaScriptHandler();
    const params = { use: "server" };

    expect(handler.matches(params, { language: "javascript", value: "", meta: "" })).toBe(true);
    expect(handler.matches(params, { language: "js", value: "", meta: "" })).toBe(true);
    expect(handler.matches(params, { language: "typescript", value: "", meta: "" })).toBe(true);
    expect(handler.matches(params, { language: "ts", value: "", meta: "" })).toBe(true);
    expect(handler.matches(params, { language: "jsx", value: "", meta: "" })).toBe(true);
    expect(handler.matches(params, { language: "tsx", value: "", meta: "" })).toBe(true);
  });

  it("should not match non-JS languages", () => {
    const handler = createDefaultJavaScriptHandler();
    const params = { use: "server" };

    expect(handler.matches(params, { language: "python", value: "", meta: "" })).toBe(false);
    expect(handler.matches(params, { language: "ruby", value: "", meta: "" })).toBe(false);
    expect(handler.matches(params, { language: "css", value: "", meta: "" })).toBe(false);
  });

  it("should not match without :use server", () => {
    const handler = createDefaultJavaScriptHandler();

    expect(handler.matches({ use: "client" }, { language: "javascript", value: "", meta: "" })).toBe(false);
    expect(handler.matches({}, { language: "javascript", value: "", meta: "" })).toBe(false);
  });

  it("should execute simple JavaScript code", async () => {
    const handler = createDefaultJavaScriptHandler();
    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "server" },
      block: { language: "javascript", value: "return 42", meta: "" },
    };
    const result = await handler.onServer("return 42", mockContext);

    expect(result.error).toBeUndefined();
    expect(result.result).toBe(42);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it("should execute async JavaScript code", async () => {
    const handler = createDefaultJavaScriptHandler();
    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "server" },
      block: { language: "javascript", value: "", meta: "" },
    };
    const result = await handler.onServer(
      "return await Promise.resolve('async result')",
      mockContext
    );

    expect(result.error).toBeUndefined();
    expect(result.result).toBe("async result");
  });

  it("should handle execution errors", async () => {
    const handler = createDefaultJavaScriptHandler();
    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "server" },
      block: { language: "javascript", value: "", meta: "" },
    };
    const result = await handler.onServer(
      "throw new Error('Test error')",
      mockContext
    );

    expect(result.error).toBeDefined();
    expect(result.error!.message).toBe("Test error");
    expect(result.result).toBeNull();
  });

  it("should timeout long-running code", async () => {
    const handler = createDefaultJavaScriptHandler({ timeout: 100 });
    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "server" },
      block: { language: "javascript", value: "", meta: "" },
    };
    const result = await handler.onServer(
      "await new Promise(r => setTimeout(r, 1000)); return 'done'",
      mockContext
    );

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain("timeout");
  });

  it("should have access to content helpers", async () => {
    const handler = createDefaultJavaScriptHandler();
    mockContentHelpers.getContentPages.mockResolvedValueOnce([
      { file: "a.org" },
      { file: "b.org" },
    ]);

    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "server" },
      block: { language: "javascript", value: "", meta: "" },
    };

    const result = await handler.onServer(
      "const pages = await content.getContentPages(); return pages.length;",
      mockContext
    );

    expect(result.error).toBeUndefined();
    expect(result.result).toBe(2);
    expect(mockContentHelpers.getContentPages).toHaveBeenCalled();
  });

  it("should generate display code for JSON results", () => {
    const handler = createDefaultJavaScriptHandler();
    const context = {
      blockId: "block-test-0",
      orgFilePath: "test.org",
      blockIndex: 0,
      params: {},
    };

    const displayCode = handler.onClient!({ foo: "bar", count: 42 }, context);

    expect(displayCode).toContain("block-test-0-result");
    expect(displayCode).toContain("JSON.stringify");
    expect(displayCode).toContain('"foo"');
    expect(displayCode).toContain('"bar"');
  });

  it("should generate display code for primitive results", () => {
    const handler = createDefaultJavaScriptHandler();
    const context = {
      blockId: "block-test-0",
      orgFilePath: "test.org",
      blockIndex: 0,
      params: {},
    };

    const displayCode = handler.onClient!("Hello World", context);

    expect(displayCode).toContain("block-test-0-result");
    expect(displayCode).toContain("textContent");
    expect(displayCode).toContain("Hello World");
  });

  it("should handle null/undefined results", () => {
    const handler = createDefaultJavaScriptHandler();
    const context = {
      blockId: "block-test-0",
      orgFilePath: "test.org",
      blockIndex: 0,
      params: {},
    };

    const displayCodeNull = handler.onClient!(null, context);
    const displayCodeUndefined = handler.onClient!(undefined, context);

    expect(displayCodeNull).toContain("No result to display");
    expect(displayCodeUndefined).toContain("No result to display");
  });
});

describe("createServerHandler", () => {
  it("should wrap handler with timeout handling", async () => {
    const handler = createServerHandler(
      (params) => params.use === "test",
      {
        async onServer(code, ctx) {
          await new Promise((r) => setTimeout(r, 200));
          return "done";
        },
        options: { timeout: 50 },
      }
    );

    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "test" },
      block: { language: "custom", value: "", meta: "" },
    };

    const result = await handler.onServer("code", mockContext);

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain("timeout");
  });

  it("should track execution time", async () => {
    const handler = createServerHandler(
      (params) => params.use === "test",
      {
        async onServer(code, ctx) {
          return "instant";
        },
      }
    );

    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "test" },
      block: { language: "custom", value: "", meta: "" },
    };

    const result = await handler.onServer("code", mockContext);

    expect(result.executionTime).toBeDefined();
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it("should catch and format errors", async () => {
    const handler = createServerHandler(
      (params) => params.use === "test",
      {
        async onServer(code, ctx) {
          throw new Error("Custom error message");
        },
      }
    );

    const mockContext = {
      contentHelpers: mockContentHelpers,
      orgFilePath: "test.org",
      blockIndex: 0,
      params: { use: "test" },
      block: { language: "custom", value: "", meta: "" },
    };

    const result = await handler.onServer("code", mockContext);

    expect(result.error).toBeDefined();
    expect(result.error!.message).toBe("Custom error message");
    expect(result.result).toBeNull();
  });
});

describe("Default serverPlugin", () => {
  it("should be pre-configured with JavaScript handler", () => {
    expect(serverPlugin.name).toBe("server");
    expect(serverPlugin.priority).toBe(15);

    const jsBlock: CodeBlock = {
      meta: ":use server",
      language: "javascript",
      value: "return 42",
    };

    expect(serverPlugin.matches!(jsBlock)).toBe(true);
  });

  it("should have transform hook that returns no-op code", async () => {
    const result = await serverPlugin.transform!(
      { language: "javascript", value: "", meta: ":use server" },
      createMockContext()
    );

    expect(result.code).toContain("Server-side execution");
  });
});

describe("serverOnlyPlugin", () => {
  it("should throw error in browser", async () => {
    const result = await serverOnlyPlugin.transform!(
      { language: "javascript", value: "", meta: "" },
      createMockContext()
    );

    expect(result.code).toContain("throw new Error");
    expect(result.code).toContain("server-only");
  });
});
