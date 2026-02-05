/**
 * Tests for hydration runtime
 *
 * These tests actually execute the runtime functions with mock DOM elements,
 * verifying real behavior rather than just checking string patterns.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isReactElement,
  renderResult,
  hydrateBlock,
  hydrateBlocks,
  type BlockModule,
  type BlockRegistryEntry,
} from "./hydrate-runtime.ts";

// Mock DOM element factory
function createMockElement(id = "test-el"): HTMLElement {
  const childNodes: Node[] = [];
  return {
    id,
    innerHTML: "",
    textContent: "",
    get childNodes() {
      return childNodes;
    },
    hasChildNodes() {
      return childNodes.length > 0;
    },
    appendChild(child: Node) {
      childNodes.push(child);
      return child;
    },
  } as unknown as HTMLElement;
}

describe("hydrate-runtime", () => {
  describe("isReactElement", () => {
    it("should return false for null", () => {
      expect(isReactElement(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isReactElement(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isReactElement(42)).toBe(false);
      expect(isReactElement("string")).toBe(false);
      expect(isReactElement(true)).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isReactElement({})).toBe(false);
      expect(isReactElement({ foo: "bar" })).toBe(false);
    });

    it("should return true for React elements", () => {
      const reactElement = { $$typeof: Symbol.for("react.element") };
      expect(isReactElement(reactElement)).toBe(true);
    });

    it("should return true for React transitional elements", () => {
      const reactElement = { $$typeof: Symbol.for("react.transitional.element") };
      expect(isReactElement(reactElement)).toBe(true);
    });
  });

  describe("renderResult", () => {
    let el: HTMLElement;

    beforeEach(() => {
      el = createMockElement();
    });

    it("should do nothing for null", () => {
      renderResult(el, null);
      expect(el.innerHTML).toBe("");
      expect(el.textContent).toBe("");
    });

    it("should do nothing for undefined", () => {
      renderResult(el, undefined);
      expect(el.innerHTML).toBe("");
      expect(el.textContent).toBe("");
    });

    it("should call function results with element id", () => {
      const fn = vi.fn();
      renderResult(el, fn);
      expect(fn).toHaveBeenCalledWith("test-el");
    });

    it("should append HTMLElement results", () => {
      const child = document.createElement("div");
      // Mock instanceof check
      Object.setPrototypeOf(child, HTMLElement.prototype);

      renderResult(el, child);
      expect(el.hasChildNodes()).toBe(true);
    });

    it("should not append HTMLElement if already has children", () => {
      // Pre-populate with a child
      el.appendChild(document.createTextNode("existing"));

      const child = { nodeType: 1 } as unknown as HTMLElement;
      const appendSpy = vi.spyOn(el, "appendChild");

      renderResult(el, child);
      // appendChild should not be called again
      expect(appendSpy).not.toHaveBeenCalledWith(child);
    });

    it("should set innerHTML for HTML strings", () => {
      renderResult(el, "<div>Hello</div>");
      expect(el.innerHTML).toBe("<div>Hello</div>");
    });

    it("should set textContent for plain strings", () => {
      renderResult(el, "Hello World");
      expect(el.textContent).toBe("Hello World");
    });

    it("should convert numbers to string", () => {
      renderResult(el, 42);
      expect(el.textContent).toBe("42");
    });

    it("should convert booleans to string", () => {
      renderResult(el, true);
      expect(el.textContent).toBe("true");
    });

    it("should JSON stringify objects", () => {
      renderResult(el, { foo: "bar" });
      expect(el.innerHTML).toContain("<pre>");
      expect(el.innerHTML).toContain('"foo"');
      expect(el.innerHTML).toContain('"bar"');
    });

    it("should JSON stringify arrays", () => {
      renderResult(el, [1, 2, 3]);
      expect(el.innerHTML).toContain("<pre>");
      expect(el.innerHTML).toContain("1");
      expect(el.innerHTML).toContain("2");
      expect(el.innerHTML).toContain("3");
    });
  });

  describe("hydrateBlock", () => {
    let originalQuerySelector: typeof document.querySelector;

    beforeEach(() => {
      originalQuerySelector = document.querySelector;
    });

    afterEach(() => {
      document.querySelector = originalQuerySelector;
    });

    it("should do nothing if element not found", async () => {
      document.querySelector = vi.fn().mockReturnValue(null);

      const entry: BlockRegistryEntry = {
        module: { default: "test" },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      // Should not throw
      await expect(hydrateBlock("missing-block", entry)).resolves.toBeUndefined();
    });

    it("should call render function with result and element", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const renderFn = vi.fn().mockReturnValue(null);
      const entry: BlockRegistryEntry = {
        module: { default: "test-data", render: renderFn },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      // CRITICAL: render must be called with BOTH result AND el
      expect(renderFn).toHaveBeenCalledWith("test-data", el);
    });

    it("should await Promise results from default export", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const renderFn = vi.fn().mockReturnValue(null);
      const entry: BlockRegistryEntry = {
        module: { default: Promise.resolve("async-data"), render: renderFn },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(renderFn).toHaveBeenCalledWith("async-data", el);
    });

    it("should use renderResult when no render function provided", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const entry: BlockRegistryEntry = {
        module: { default: "plain string result" },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(el.textContent).toBe("plain string result");
    });

    it("should handle render function returning HTMLElement", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const childEl = createMockElement("child");
      Object.setPrototypeOf(childEl, HTMLElement.prototype);

      const entry: BlockRegistryEntry = {
        module: {
          default: null,
          render: () => childEl,
        },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(el.hasChildNodes()).toBe(true);
    });

    it("should handle render function returning HTML string", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const entry: BlockRegistryEntry = {
        module: {
          default: { count: 5 },
          render: (result: { count: number }) => `<span>Count: ${result.count}</span>`,
        },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(el.innerHTML).toBe("<span>Count: 5</span>");
    });

    it("should handle render function returning plain string", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);

      const entry: BlockRegistryEntry = {
        module: {
          default: "world",
          render: (result: string) => `Hello ${result}`,
        },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(el.textContent).toBe("Hello world");
    });

    it("should catch and log errors", async () => {
      const el = createMockElement("block-1");
      document.querySelector = vi.fn().mockReturnValue(el);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const entry: BlockRegistryEntry = {
        module: {
          default: null,
          render: () => {
            throw new Error("Test error");
          },
        },
        ext: "ts",
        isReact: false,
        modeName: "dom",
      };

      await hydrateBlock("block-1", entry);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[org-press] Failed to hydrate block block-1:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("hydrateBlocks", () => {
    it("should hydrate all blocks in registry", async () => {
      const el1 = createMockElement("block-1");
      const el2 = createMockElement("block-2");

      document.querySelector = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes("block-1")) return el1;
        if (selector.includes("block-2")) return el2;
        return null;
      });

      const blocks: Record<string, BlockRegistryEntry> = {
        "block-1": {
          module: { default: "result-1" },
          ext: "ts",
          isReact: false,
          modeName: "dom",
        },
        "block-2": {
          module: { default: "result-2" },
          ext: "ts",
          isReact: false,
          modeName: "dom",
        },
      };

      await hydrateBlocks(blocks);

      expect(el1.textContent).toBe("result-1");
      expect(el2.textContent).toBe("result-2");
    });
  });
});
