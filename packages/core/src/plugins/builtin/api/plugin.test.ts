/**
 * Tests for API plugin
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiPlugin } from "./plugin.ts";
import { clearRoutes, getApiRoutes, setMode } from "./registry.ts";
import type { CodeBlock, TransformContext } from "../../types.ts";

describe("API Plugin", () => {
  beforeEach(() => {
    clearRoutes();
    setMode("dev");
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const createBlock = (code: string, meta: string): CodeBlock => ({
    value: code,
    language: "javascript",
    meta,
  });

  const createContext = (): TransformContext => ({
    orgFilePath: "/content/test.org",
    plugins: [],
    config: {} as any,
    cacheDir: "/cache",
    base: "/",
    contentDir: "/content",
    outDir: "/out",
    blockIndex: 0,
    parameters: {},
  });

  describe("plugin properties", () => {
    it("should have correct name", () => {
      expect(apiPlugin.name).toBe("api");
    });

    it("should have high priority", () => {
      expect(apiPlugin.priority).toBe(100);
    });

    it("should have js default extension", () => {
      expect(apiPlugin.defaultExtension).toBe("js");
    });
  });

  describe("matches", () => {
    it("should match blocks with :use api", () => {
      const block = createBlock("", ':use api :endpoint "/api/test"');
      expect(apiPlugin.matches?.(block)).toBe(true);
    });

    it("should not match blocks without :use api", () => {
      const block = createBlock("", ":use dom");
      expect(apiPlugin.matches?.(block)).toBe(false);
    });

    it("should not match blocks with other :use values", () => {
      const block = createBlock("", ":use server");
      expect(apiPlugin.matches?.(block)).toBe(false);
    });
  });

  describe("transform", () => {
    it("should register API route during transform", async () => {
      // Use simpler code without trailing semicolon
      const block = createBlock(
        'export default async (req, res) => { res.json({ hello: "world" }) }',
        ':use api :endpoint "/api/hello"'
      );
      const ctx = createContext();

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(1);
      expect(routes[0].endpoint).toBe("/api/hello");
      expect(routes[0].method).toBe("GET");
    });

    it("should register route with custom method", async () => {
      const block = createBlock(
        "export default async (req, res) => { res.json({ ok: true }) }",
        ':use api :endpoint "/api/data" :method POST'
      );
      const ctx = createContext();

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes[0].method).toBe("POST");
    });

    it("should register previewOnly routes", async () => {
      const block = createBlock(
        "export default async (req, res) => { }",
        ':use api :endpoint "/api/dev" :previewOnly true'
      );
      const ctx = createContext();

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes[0].previewOnly).toBe(true);
    });

    it("should return code with API endpoint info (no client-side execution)", async () => {
      const block = createBlock(
        "export default async (req, res) => { }",
        ':use api :endpoint "/api/test"'
      );
      const ctx = createContext();

      const result = await apiPlugin.transform?.(block, ctx);

      expect(result?.code).toContain("API endpoint");
    });

    it("should track source path", async () => {
      const block = createBlock(
        "export default async (req, res) => { }",
        ':use api :endpoint "/api/test"'
      );
      const ctx = createContext();
      ctx.orgFilePath = "/content/pages/api-page.org";

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes[0].sourcePath).toBe("/content/pages/api-page.org");
    });

    it("should handle missing endpoint gracefully", async () => {
      const block = createBlock(
        "export default async (req, res) => { }",
        ":use api" // No endpoint
      );
      const ctx = createContext();

      // Should not throw, but may log a warning
      const result = await apiPlugin.transform?.(block, ctx);
      expect(result).toBeDefined();

      // Route should not be registered without valid endpoint
      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(0);
    });
  });

  describe("handler compilation", () => {
    it("should register a handler function for routes", async () => {
      const block = createBlock(
        `export default async (req, res) => {
          res.json({ message: "Hello" })
        }`,
        ':use api :endpoint "/api/greet"'
      );
      const ctx = createContext();

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(1);
      // Handler should always be a function (either the compiled one or error handler)
      expect(typeof routes[0].handler).toBe("function");
    });

    it("should return error handler when compilation fails", async () => {
      const block = createBlock(
        `this is not valid javascript!!!`,
        ':use api :endpoint "/api/broken"'
      );
      const ctx = createContext();

      await apiPlugin.transform?.(block, ctx);

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(1);
      expect(typeof routes[0].handler).toBe("function");

      // The error handler should call res.status(500).json()
      let statusCode: number | undefined;
      let capturedData: any;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          capturedData = data;
        },
      };

      await routes[0].handler({} as any, mockRes as any);
      expect(statusCode).toBe(500);
      expect(capturedData.error).toContain("compilation failed");
    });
  });
});
