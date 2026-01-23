import { describe, it, expect, vi } from "vitest";
import {
  composeWrappers,
  composeWrappersSync,
  MapWrapperRegistry,
  identityWrapper,
  createSimpleWrapper,
  registerWrapper,
  getWrapper,
  globalRegistry,
} from "./wrapper-compose.ts";
import { parsePipe } from "./pipe-parser.ts";
import type { PreviewFn, Wrapper, WrapperFactory, BlockContext } from "./preview.ts";

// Mock context for tests
const mockContext: BlockContext = {
  file: { path: "test.org", absolute: "/test.org" },
  block: {
    content: "const x = 1;",
    language: "javascript",
    params: {},
    index: 0,
  },
  runtime: { isDev: true, baseUrl: "/" },
};

// Helper to create a test wrapper that adds a prefix
function createPrefixWrapper(prefix: string): WrapperFactory {
  return () => (preview) => (result, ctx) => {
    const inner = preview(result, ctx);
    return `${prefix}[${inner}]`;
  };
}

describe("Wrapper Composition", () => {
  describe("MapWrapperRegistry", () => {
    it("should register and retrieve wrappers", () => {
      const registry = new MapWrapperRegistry();
      const factory: WrapperFactory = () => (p) => p;

      registry.register("test", factory);

      expect(registry.has("test")).toBe(true);
      expect(registry.get("test")).toBe(factory);
    });

    it("should return undefined for unknown wrapper", () => {
      const registry = new MapWrapperRegistry();

      expect(registry.has("unknown")).toBe(false);
      expect(registry.get("unknown")).toBeUndefined();
    });

    it("should list all registered wrapper names", () => {
      const registry = new MapWrapperRegistry();
      registry.register("a", () => (p) => p);
      registry.register("b", () => (p) => p);
      registry.register("c", () => (p) => p);

      const keys = registry.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
    });
  });

  describe("composeWrappers", () => {
    it("should return base preview for empty segments", async () => {
      const basePreview: PreviewFn = () => "base";
      const result = await composeWrappers([], { basePreview });

      expect(result("input", mockContext)).toBe("base");
    });

    it("should return base preview for single segment (mode only)", async () => {
      const segments = parsePipe("preview");
      const basePreview: PreviewFn = () => "base";
      const result = await composeWrappers(segments, { basePreview });

      expect(result("input", mockContext)).toBe("base");
    });

    it("should apply single wrapper", async () => {
      const registry = new MapWrapperRegistry();
      registry.register("wrap", createPrefixWrapper("W"));

      const segments = parsePipe("preview | wrap");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = await composeWrappers(segments, { registry, basePreview });

      expect(composed("test", mockContext)).toBe("W[test]");
    });

    it("should apply multiple wrappers in correct order", async () => {
      const registry = new MapWrapperRegistry();
      registry.register("A", createPrefixWrapper("A"));
      registry.register("B", createPrefixWrapper("B"));
      registry.register("C", createPrefixWrapper("C"));

      const segments = parsePipe("preview | A | B | C");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = await composeWrappers(segments, { registry, basePreview });

      // A(B(C(preview))) -> A[B[C[result]]]
      expect(composed("x", mockContext)).toBe("A[B[C[x]]]");
    });

    it("should pass config to wrapper factory", async () => {
      const registry = new MapWrapperRegistry();
      registry.register("withPrefix", (config) => {
        const prefix = (config?.prefix as string) ?? "DEFAULT";
        return (preview) => (result, ctx) => `${prefix}:${preview(result, ctx)}`;
      });

      const segments = parsePipe("preview | withPrefix?prefix=CUSTOM");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = await composeWrappers(segments, { registry, basePreview });

      expect(composed("test", mockContext)).toBe("CUSTOM:test");
    });

    it("should skip unknown wrappers", async () => {
      const registry = new MapWrapperRegistry();
      registry.register("known", createPrefixWrapper("K"));

      const segments = parsePipe("preview | known | unknown | known");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = await composeWrappers(segments, { registry, basePreview });

      // unknown is skipped, so: K(K(preview)) -> K[K[result]]
      expect(composed("x", mockContext)).toBe("K[K[x]]");
    });

    it("should call onUnknownWrapper for unknown wrappers", async () => {
      const onUnknown = vi.fn();
      const segments = parsePipe("preview | unknown1 | unknown2");

      await composeWrappers(segments, { onUnknownWrapper: onUnknown });

      expect(onUnknown).toHaveBeenCalledTimes(2);
      expect(onUnknown).toHaveBeenCalledWith("unknown1");
      expect(onUnknown).toHaveBeenCalledWith("unknown2");
    });

    it("should resolve org imports via handler", async () => {
      const resolveOrgImport = vi.fn().mockResolvedValue(createPrefixWrapper("ORG"));

      const segments = parsePipe("preview | ./custom.org?name=myWrapper");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = await composeWrappers(segments, {
        basePreview,
        resolveOrgImport,
      });

      expect(resolveOrgImport).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "./custom.org",
          isOrgImport: true,
          blockName: "myWrapper",
        })
      );
      expect(composed("test", mockContext)).toBe("ORG[test]");
    });

    it("should skip org imports when no resolver provided", async () => {
      const onUnknown = vi.fn();
      const segments = parsePipe("preview | ./custom.org?name=myWrapper");
      const basePreview: PreviewFn = (result) => `${result}`;

      const composed = await composeWrappers(segments, {
        basePreview,
        onUnknownWrapper: onUnknown,
      });

      expect(onUnknown).toHaveBeenCalledWith("./custom.org");
      expect(composed("test", mockContext)).toBe("test");
    });
  });

  describe("composeWrappersSync", () => {
    it("should compose wrappers synchronously", () => {
      const registry = new MapWrapperRegistry();
      registry.register("A", createPrefixWrapper("A"));
      registry.register("B", createPrefixWrapper("B"));

      const segments = parsePipe("preview | A | B");
      const basePreview: PreviewFn = (result) => `${result}`;
      const composed = composeWrappersSync(segments, { registry, basePreview });

      expect(composed("x", mockContext)).toBe("A[B[x]]");
    });

    it("should skip org imports in sync mode", () => {
      const onUnknown = vi.fn();
      const segments = parsePipe("preview | ./custom.org?name=myWrapper");

      composeWrappersSync(segments, { onUnknownWrapper: onUnknown });

      expect(onUnknown).toHaveBeenCalledWith("./custom.org");
    });
  });

  describe("identityWrapper", () => {
    it("should return the preview unchanged", () => {
      const wrapper = identityWrapper();
      const preview: PreviewFn = () => "original";
      const wrapped = wrapper(preview);

      expect(wrapped("any", mockContext)).toBe("original");
    });
  });

  describe("createSimpleWrapper", () => {
    it("should create a wrapper from a transform function", () => {
      const factory = createSimpleWrapper((result, preview) => {
        return `transformed:${result}`;
      });

      const wrapper = factory();
      const preview: PreviewFn = (result) => `preview:${result}`;
      const wrapped = wrapper(preview);

      expect(wrapped("input", mockContext)).toBe("transformed:input");
    });
  });

  describe("global registry", () => {
    it("should register and retrieve from global registry", () => {
      const testName = `test-global-${Date.now()}`;
      const factory: WrapperFactory = () => (p) => p;

      registerWrapper(testName, factory);

      expect(getWrapper(testName)).toBe(factory);
      expect(globalRegistry.has(testName)).toBe(true);
    });
  });
});
