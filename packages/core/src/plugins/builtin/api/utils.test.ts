/**
 * Tests for API plugin utilities
 */

import { describe, it, expect } from "vitest";
import {
  matchRoute,
  parseQueryString,
  parseApiBlockParams,
  validateEndpoint,
  normalizeMethod,
  getPathname,
} from "./utils.ts";

describe("API Plugin Utils", () => {
  describe("matchRoute", () => {
    it("should match exact static paths", () => {
      const result = matchRoute("/api/hello", "/api/hello");
      expect(result.matched).toBe(true);
      expect(result.params).toEqual({});
    });

    it("should not match different static paths", () => {
      const result = matchRoute("/api/hello", "/api/goodbye");
      expect(result.matched).toBe(false);
    });

    it("should extract single URL parameter", () => {
      const result = matchRoute("/api/users/:id", "/api/users/123");
      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ id: "123" });
    });

    it("should extract multiple URL parameters", () => {
      const result = matchRoute("/api/users/:userId/posts/:postId", "/api/users/42/posts/99");
      expect(result.matched).toBe(true);
      expect(result.params).toEqual({ userId: "42", postId: "99" });
    });

    it("should not match paths with different segment counts", () => {
      const result = matchRoute("/api/users/:id", "/api/users");
      expect(result.matched).toBe(false);
    });

    it("should handle root path", () => {
      const result = matchRoute("/", "/");
      expect(result.matched).toBe(true);
    });

    it("should handle trailing slashes", () => {
      const result = matchRoute("/api/hello", "/api/hello/");
      // Implementation normalizes by splitting on "/" and filtering empty strings
      // So "/api/hello/" becomes ["api", "hello"] which matches "/api/hello"
      expect(result.matched).toBe(true);
    });
  });

  describe("parseQueryString", () => {
    it("should parse query parameters from URL", () => {
      const result = parseQueryString("/api/hello?name=world&count=5");
      expect(result).toEqual({ name: "world", count: "5" });
    });

    it("should return empty object for URL without query", () => {
      const result = parseQueryString("/api/hello");
      expect(result).toEqual({});
    });

    it("should handle URL-encoded values", () => {
      const result = parseQueryString("/api/search?q=hello%20world");
      expect(result).toEqual({ q: "hello world" });
    });

    it("should handle empty query string", () => {
      const result = parseQueryString("/api/hello?");
      expect(result).toEqual({});
    });
  });

  describe("parseApiBlockParams", () => {
    it("should parse endpoint from meta string", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/hello"');
      expect(result.endpoint).toBe("/api/hello");
    });

    it("should parse endpoint without quotes", () => {
      const result = parseApiBlockParams(":use api :endpoint /api/simple");
      expect(result.endpoint).toBe("/api/simple");
    });

    it("should parse method from meta string", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/data" :method POST');
      expect(result.method).toBe("POST");
    });

    it("should return undefined for missing method", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/hello"');
      // Method is undefined when not specified - caller should default to GET
      expect(result.method).toBeUndefined();
    });

    it("should parse previewOnly flag as string", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/dev" :previewOnly true');
      // previewOnly is parsed as string "true", caller converts to boolean
      expect(result.previewOnly).toBe("true");
    });

    it("should return undefined for missing previewOnly", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/hello"');
      // previewOnly is undefined when not specified
      expect(result.previewOnly).toBeUndefined();
    });

    it("should handle complex endpoint with params in quotes", () => {
      const result = parseApiBlockParams(':use api :endpoint "/api/users/:userId/posts/:postId"');
      expect(result.endpoint).toBe("/api/users/:userId/posts/:postId");
    });
  });

  describe("validateEndpoint", () => {
    it("should accept valid endpoints", () => {
      expect(validateEndpoint("/api/hello")).toBeNull();
      expect(validateEndpoint("/api/users/:id")).toBeNull();
      expect(validateEndpoint("/")).toBeNull();
    });

    it("should reject endpoints without leading slash", () => {
      const error = validateEndpoint("api/hello");
      expect(error).toContain('must start with "/"');
    });

    it("should reject empty endpoints", () => {
      const error = validateEndpoint("");
      expect(error).not.toBeNull();
    });
  });

  describe("normalizeMethod", () => {
    it("should uppercase method", () => {
      expect(normalizeMethod("get")).toBe("GET");
      expect(normalizeMethod("post")).toBe("POST");
      expect(normalizeMethod("Put")).toBe("PUT");
    });

    it("should default to GET for undefined", () => {
      expect(normalizeMethod(undefined)).toBe("GET");
    });

    it("should handle * for any method", () => {
      expect(normalizeMethod("*")).toBe("*");
    });
  });

  describe("getPathname", () => {
    it("should extract pathname from URL with query", () => {
      expect(getPathname("/api/hello?name=world")).toBe("/api/hello");
    });

    it("should return pathname for URL without query", () => {
      expect(getPathname("/api/hello")).toBe("/api/hello");
    });

    it("should handle root path", () => {
      expect(getPathname("/")).toBe("/");
    });
  });
});
