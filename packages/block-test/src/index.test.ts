/**
 * Tests for @org-press/block-test plugin
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { testPlugin } from "./index.ts";
import {
  parseTestResultsModuleId,
  createTestResultsModuleId,
  TEST_RESULTS_VIRTUAL_PREFIX,
} from "./types.ts";
import {
  generateVirtualTestId,
  isVirtualTestId,
  parseVirtualTestId,
} from "./test-collector.ts";
import type { CodeBlock, TransformContext } from "org-press";

describe("testPlugin", () => {
  test("should export plugin with correct name", () => {
    expect(testPlugin.name).toBe("test");
  });

  test("should have correct default extension", () => {
    expect(testPlugin.defaultExtension).toBe("js");
  });

  test("should have CLI command registered", () => {
    expect(testPlugin.cli).toBeDefined();
    expect(testPlugin.cli?.command).toBe("test");
    expect(testPlugin.cli?.description).toBe("Run test blocks in org files");
    expect(typeof testPlugin.cli?.execute).toBe("function");
  });

  describe("matches", () => {
    test("should match blocks with :use test", () => {
      const block: CodeBlock = {
        language: "typescript",
        value: "test code",
        meta: ":use test",
      };
      expect(testPlugin.matches?.(block)).toBe(true);
    });

    test("should not match blocks without :use test", () => {
      const block: CodeBlock = {
        language: "typescript",
        value: "test code",
        meta: ":exports both",
      };
      expect(testPlugin.matches?.(block)).toBe(false);
    });

    test("should not match blocks with :use other", () => {
      const block: CodeBlock = {
        language: "typescript",
        value: "test code",
        meta: ":use jscad",
      };
      expect(testPlugin.matches?.(block)).toBe(false);
    });
  });

  describe("transform", () => {
    test("should return code with render function", async () => {
      const block: CodeBlock = {
        language: "typescript",
        value: `describe('test', () => { it('works', () => expect(1).toBe(1)); });`,
        meta: ":use test",
      };

      const context: Partial<TransformContext> = {
        orgFilePath: "content/test.org",
        blockIndex: 0,
        blockName: "my-tests",
        parameters: { use: "test" },
        plugins: [],
        config: {},
        cacheDir: "/tmp/cache",
        base: "/",
        contentDir: "content",
        outDir: "dist",
      };

      const result = await testPlugin.transform?.(
        block,
        context as TransformContext
      );

      expect(result).toBeDefined();
      expect(result?.code).toContain("import renderTestResults from '@org-press/block-test/wrapper'");
      expect(result?.code).toContain("export default function render(containerId)");
      expect(result?.code).toContain("block-content-test-org-0");
    });
  });
});

describe("types", () => {
  describe("createTestResultsModuleId", () => {
    test("should create virtual module ID", () => {
      const id = createTestResultsModuleId("content/test.org", 0);
      expect(id).toBe("virtual:org-press:test-results:content/test.org:0");
    });

    test("should handle nested paths", () => {
      const id = createTestResultsModuleId("content/docs/api/test.org", 5);
      expect(id).toBe(
        "virtual:org-press:test-results:content/docs/api/test.org:5"
      );
    });
  });

  describe("parseTestResultsModuleId", () => {
    test("should parse valid module ID", () => {
      const result = parseTestResultsModuleId(
        "virtual:org-press:test-results:content/test.org:0"
      );
      expect(result).toEqual({
        orgFilePath: "content/test.org",
        blockIndex: 0,
      });
    });

    test("should parse module ID with nested path", () => {
      const result = parseTestResultsModuleId(
        "virtual:org-press:test-results:content/docs/api/test.org:5"
      );
      expect(result).toEqual({
        orgFilePath: "content/docs/api/test.org",
        blockIndex: 5,
      });
    });

    test("should return null for invalid ID", () => {
      expect(parseTestResultsModuleId("invalid:id")).toBeNull();
      expect(parseTestResultsModuleId("virtual:other:test.org:0")).toBeNull();
    });
  });
});

describe("test-collector", () => {
  describe("generateVirtualTestId", () => {
    test("should generate virtual test ID", () => {
      const block = {
        orgFilePath: "content/test.org",
        blockIndex: 0,
        code: "test code",
        language: "typescript",
      };
      const id = generateVirtualTestId(block);
      expect(id).toBe("virtual:org-test:content/test.org:0");
    });
  });

  describe("isVirtualTestId", () => {
    test("should return true for virtual test IDs", () => {
      expect(isVirtualTestId("virtual:org-test:test.org:0")).toBe(true);
    });

    test("should return false for other IDs", () => {
      expect(isVirtualTestId("virtual:other:test.org:0")).toBe(false);
      expect(isVirtualTestId("./test.org")).toBe(false);
    });
  });

  describe("parseVirtualTestId", () => {
    test("should parse valid virtual test ID", () => {
      const result = parseVirtualTestId("virtual:org-test:content/test.org:0");
      expect(result).toEqual({
        orgFilePath: "content/test.org",
        blockIndex: 0,
      });
    });

    test("should return null for invalid ID", () => {
      expect(parseVirtualTestId("invalid:id")).toBeNull();
    });
  });
});
