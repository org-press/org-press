/**
 * Serve Single File Tests
 *
 * Tests for the hashbang serve functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";

// Mock Vite's createServer
vi.mock("vite", () => ({
  createServer: vi.fn(),
}));

import { createServer } from "vite";

describe("Serve Single File", () => {
  const mockMiddlewares = {
    use: vi.fn(),
  };

  const mockServer = {
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    config: { server: { port: 3000 } },
    watcher: {
      add: vi.fn(),
      on: vi.fn(),
    },
    middlewares: mockMiddlewares,
    moduleGraph: {
      invalidateAll: vi.fn(),
    },
    ws: {
      send: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServer as any).mockResolvedValue(mockServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("middleware registration", () => {
    it("should register SSR middleware directly (not via return function)", async () => {
      // This test verifies that the fix for Issue 4 is in place
      // The middleware should be registered directly in configureServer,
      // not via a return function which would run after Vite's internal middleware

      const { serveSingleFile } = await import("./serve-single.ts");

      // Create a temp org file for testing
      const tempDir = path.join(process.cwd(), ".test-serve-single");
      const tempFile = path.join(tempDir, "test.org");

      try {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(tempFile, "#+TITLE: Test\n\n* Hello\n\nWorld");

        await serveSingleFile({ file: tempFile, port: 3000 });

        // Verify createServer was called with our plugin
        expect(createServer).toHaveBeenCalledTimes(1);
        const createServerCall = (createServer as any).mock.calls[0][0];

        // The plugin should be in the plugins array
        expect(createServerCall.plugins).toBeDefined();
        expect(createServerCall.plugins.length).toBeGreaterThan(0);

        // Find our plugin
        const orgPressPlugin = createServerCall.plugins.find(
          (p: any) => p.name === "org-press:serve-single"
        );
        expect(orgPressPlugin).toBeDefined();

        // Call configureServer to verify middleware is registered directly
        const configureServerResult = orgPressPlugin.configureServer(mockServer);

        // The key fix: configureServer should NOT return a function
        // If it returns a function, middleware is registered AFTER Vite's internal middleware
        // which causes 404 errors
        expect(configureServerResult).toBeUndefined();

        // Verify middleware was registered
        expect(mockMiddlewares.use).toHaveBeenCalled();
      } finally {
        // Cleanup
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      }
    });

    it("should externalize React (user must install if needed)", async () => {
      const { serveSingleFile } = await import("./serve-single.ts");

      // Create a temp org file for testing
      const tempDir = path.join(process.cwd(), ".test-serve-single");
      const tempFile = path.join(tempDir, "test.org");

      try {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(tempFile, "#+TITLE: Test\n\n* Hello\n\nWorld");

        await serveSingleFile({ file: tempFile, port: 3000 });

        const createServerCall = (createServer as any).mock.calls[0][0];

        // Zero-config mode doesn't bundle React - users install if they want it
        expect(createServerCall.ssr).toBeDefined();
        expect(createServerCall.ssr.external).toContain("react");
        expect(createServerCall.ssr.external).toContain("react-dom");
      } finally {
        // Cleanup
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      }
    });
  });
});
