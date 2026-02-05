/**
 * Tests for @org-press/block-test plugin
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { testTransformer, testCommand, testPlugin } from "./index.ts";
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

describe("testTransformer", () => {
  test("should export transformer with correct name", () => {
    expect(testTransformer.name).toBe("transformer:test");
  });

  test("should have _type set to transformer", () => {
    expect(testTransformer._type).toBe("transformer");
  });

  test("should have onBuild function", () => {
    expect(testTransformer._config).toBeDefined();
    expect(typeof testTransformer._config.onBuild).toBe("function");
  });

  describe("onBuild", () => {
    test("should return script with render function", () => {
      const input = {
        code: `describe('test', () => { it('works', () => expect(1).toBe(1)); });`,
        language: "typescript",
        params: { use: "test" },
        html: "",
        result: undefined,
      };

      const ctx = {
        id: "block-0",
        code: input.code,
        orgFilePath: "content/test.org",
        blockIndex: 0,
        blockName: "my-tests",
        params: { use: "test" },
      };

      const result = testTransformer._config.onBuild(input, ctx);

      expect(result).toBeDefined();
      expect(result.script).toContain("import renderTestResults from '@org-press/block-test/wrapper'");
      expect(result.script).toContain("export default function render(containerId)");
    });
  });
});

describe("testCommand", () => {
  test("should export command with correct name", () => {
    expect(testCommand.name).toBe("command:test");
  });

  test("should have _type set to command", () => {
    expect(testCommand._type).toBe("command");
  });

  test("should have correct description", () => {
    expect(testCommand._config.description).toBe("Run test blocks in org files");
  });

  test("should have execute function", () => {
    expect(typeof testCommand._config.execute).toBe("function");
  });
});

describe("testPlugin", () => {
  test("should be an array with transformer and command", () => {
    expect(Array.isArray(testPlugin)).toBe(true);
    expect(testPlugin).toHaveLength(2);
    expect(testPlugin).toContain(testTransformer);
    expect(testPlugin).toContain(testCommand);
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
