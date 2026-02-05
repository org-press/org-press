/**
 * Tests for API route registry
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerApiRoute,
  getApiRoutes,
  clearRoutes,
  setMode,
  isEndpointRegistered,
} from "./registry.ts";
import type { ApiRouteDefinition } from "./types.ts";

describe("API Registry", () => {
  beforeEach(() => {
    clearRoutes();
    setMode("dev"); // Default to dev mode for tests
  });

  const createRoute = (
    endpoint: string,
    method: string = "GET",
    previewOnly: boolean = false
  ): ApiRouteDefinition => ({
    endpoint,
    method,
    handler: async () => {},
    previewOnly,
    sourcePath: "test.org",
  });

  describe("registerApiRoute", () => {
    it("should register a route", () => {
      const route = createRoute("/api/hello");
      registerApiRoute(route);

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(1);
      expect(routes[0].endpoint).toBe("/api/hello");
    });

    it("should allow registering multiple routes", () => {
      registerApiRoute(createRoute("/api/one"));
      registerApiRoute(createRoute("/api/two"));
      registerApiRoute(createRoute("/api/three"));

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(3);
    });

    it("should log error on duplicate endpoint in dev mode", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      registerApiRoute(createRoute("/api/hello", "GET"));
      registerApiRoute(createRoute("/api/hello", "GET")); // Duplicate

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Duplicate endpoint")
      );

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should throw on duplicate endpoint in build mode", () => {
      setMode("build");

      registerApiRoute(createRoute("/api/hello", "GET"));

      expect(() => {
        registerApiRoute(createRoute("/api/hello", "GET"));
      }).toThrow(/already registered/);
    });

    it("should allow same endpoint with different methods", () => {
      registerApiRoute(createRoute("/api/resource", "GET"));
      registerApiRoute(createRoute("/api/resource", "POST"));

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(2);
    });
  });

  describe("getApiRoutes", () => {
    it("should return all routes when includePreviewOnly is true", () => {
      registerApiRoute(createRoute("/api/public", "GET", false));
      registerApiRoute(createRoute("/api/dev-only", "GET", true));

      const routes = getApiRoutes(true);
      expect(routes).toHaveLength(2);
    });

    it("should exclude previewOnly routes when includePreviewOnly is false", () => {
      registerApiRoute(createRoute("/api/public", "GET", false));
      registerApiRoute(createRoute("/api/dev-only", "GET", true));

      const routes = getApiRoutes(false);
      expect(routes).toHaveLength(1);
      expect(routes[0].endpoint).toBe("/api/public");
    });

    it("should default to including previewOnly routes", () => {
      registerApiRoute(createRoute("/api/public", "GET", false));
      registerApiRoute(createRoute("/api/dev-only", "GET", true));

      // Default is includePreviewOnly=true, so all routes are returned
      const routes = getApiRoutes();
      expect(routes).toHaveLength(2);
    });
  });

  describe("isEndpointRegistered", () => {
    it("should return true for registered endpoint", () => {
      registerApiRoute(createRoute("/api/hello", "GET"));

      expect(isEndpointRegistered("/api/hello", "GET")).toBe(true);
    });

    it("should return false for unregistered endpoint", () => {
      expect(isEndpointRegistered("/api/unknown", "GET")).toBe(false);
    });

    it("should distinguish between methods", () => {
      registerApiRoute(createRoute("/api/resource", "GET"));

      expect(isEndpointRegistered("/api/resource", "GET")).toBe(true);
      expect(isEndpointRegistered("/api/resource", "POST")).toBe(false);
    });
  });

  describe("clearRoutes", () => {
    it("should remove all registered routes", () => {
      registerApiRoute(createRoute("/api/one"));
      registerApiRoute(createRoute("/api/two"));

      expect(getApiRoutes(true)).toHaveLength(2);

      clearRoutes();

      expect(getApiRoutes(true)).toHaveLength(0);
    });
  });

  describe("setMode", () => {
    it("should change behavior between dev and build modes", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      setMode("dev");
      registerApiRoute(createRoute("/api/dup", "GET"));
      registerApiRoute(createRoute("/api/dup", "GET")); // Should error log in dev

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockClear();

      clearRoutes();
      setMode("build");
      registerApiRoute(createRoute("/api/dup", "GET"));

      expect(() => {
        registerApiRoute(createRoute("/api/dup", "GET"));
      }).toThrow(); // Should throw in build

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
