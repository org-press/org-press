/**
 * Tests for built-in modes
 */

import { describe, it, expect } from "vitest";
import { sourceOnlyMode } from "./source-only.ts";
import { silentMode } from "./silent.ts";
import { rawMode } from "./raw.ts";
import { builtinModes, registerBuiltinModes, isMode } from "./index.ts";
import { globalRegistry } from "../wrapper-compose.ts";
import type { RenderFunction, BlockContext } from "../preview.ts";
import { defaultRender } from "../preview.ts";

// Helper to create a mock BlockContext
function createMockContext(overrides?: Partial<BlockContext>): BlockContext {
  return {
    file: {
      path: "/test/file.org",
      relativePath: "file.org",
    },
    block: {
      language: "typescript",
      content: 'console.log("test");',
      index: 0,
      name: undefined,
      headers: {},
      ...overrides?.block,
    },
    runtime: {
      isDev: false,
      ...overrides?.runtime,
    },
    ...overrides,
  } as BlockContext;
}

// Dummy input render (modes ignore this)
const dummyRender: RenderFunction = () => "<dummy/>";

describe("sourceOnlyMode", () => {
  it("renders source code without execution result", () => {
    const mode = sourceOnlyMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({
      block: {
        language: "typescript",
        content: "const x = 42;",
        index: 0,
        headers: {},
      },
    });

    // Result is ignored, source is rendered
    const result = wrapped("ignored value", ctx);

    expect(result).toContain('class="org-source-only"');
    expect(result).toContain("const x = 42;");
    expect(result).toContain('class="language-typescript"');
    expect(result).not.toContain("ignored value");
  });

  it("adds line numbers when requested", () => {
    const mode = sourceOnlyMode({ lineNumbers: true });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({
      block: {
        language: "typescript",
        content: "line1\nline2\nline3",
        index: 0,
        headers: {},
      },
    });

    const result = wrapped("ignored", ctx);

    expect(result).toContain("1 | line1");
    expect(result).toContain("2 | line2");
    expect(result).toContain("3 | line3");
  });

  it("adds custom label", () => {
    const mode = sourceOnlyMode({ label: "Example Code" });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("ignored", ctx);

    expect(result).toContain("Example Code");
    expect(result).toContain('class="org-source-label"');
  });

  it("uses custom className", () => {
    const mode = sourceOnlyMode({ className: "my-source" });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("ignored", ctx);

    expect(result).toContain('class="my-source"');
  });

  it("escapes HTML in source code", () => {
    const mode = sourceOnlyMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({
      block: {
        language: "html",
        content: "<div>test</div>",
        index: 0,
        headers: {},
      },
    });

    const result = wrapped("ignored", ctx);

    expect(result).toContain("&lt;div&gt;test&lt;/div&gt;");
  });
});

describe("silentMode", () => {
  it("returns null by default", () => {
    const mode = silentMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("any value", ctx);

    expect(result).toBeNull();
  });

  it("shows placeholder in dev mode when configured", () => {
    const mode = silentMode({ showDevPlaceholder: true });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({
      block: {
        language: "typescript",
        content: "code",
        index: 3,
        name: "my-block",
        headers: {},
      },
      runtime: { isDev: true },
    });

    const result = wrapped("any value", ctx);

    expect(result).toContain("<!-- silent block:");
    expect(result).toContain("my-block");
  });

  it("hides placeholder in production", () => {
    const mode = silentMode({ showDevPlaceholder: true });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({ runtime: { isDev: false } });

    const result = wrapped("any value", ctx);

    expect(result).toBeNull();
  });

  it("uses custom placeholder template", () => {
    const mode = silentMode({
      showDevPlaceholder: true,
      devPlaceholder: "/* {language} block #{index} */",
    });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext({
      block: {
        language: "typescript",
        content: "code",
        index: 5,
        headers: {},
      },
      runtime: { isDev: true },
    });

    const result = wrapped("any value", ctx);

    expect(result).toBe("/* typescript block #5 */");
  });
});

describe("rawMode", () => {
  it("returns string results directly", () => {
    const mode = rawMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("<div>hello</div>", ctx);

    expect(result).toBe("<div>hello</div>");
  });

  it("returns null for null/undefined", () => {
    const mode = rawMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    expect(wrapped(null, ctx)).toBeNull();
    expect(wrapped(undefined, ctx)).toBeNull();
  });

  it("formats objects as JSON", () => {
    const mode = rawMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: 1, b: 2 }, ctx);

    expect(result).toContain("<pre><code>");
    // JSON is escaped
    expect(result).toContain("&quot;a&quot;");
    expect(result).toContain("1");
    expect(result).toContain("&quot;b&quot;");
    expect(result).toContain("2");
  });

  it("uses custom JSON indentation", () => {
    const mode = rawMode({ jsonIndent: 4 });
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: 1 }, ctx) as string;

    // 4-space indent should result in more spaces
    expect(result).toContain("    ");
  });

  it("converts primitives to strings", () => {
    const mode = rawMode();
    const wrapped = mode(dummyRender);
    const ctx = createMockContext();

    expect(wrapped(42, ctx)).toContain("42");
    expect(wrapped(true, ctx)).toContain("true");
  });
});

describe("builtinModes", () => {
  it("exports all modes", () => {
    expect(builtinModes.sourceOnly).toBe(sourceOnlyMode);
    expect(builtinModes.silent).toBe(silentMode);
    expect(builtinModes.raw).toBe(rawMode);
  });
});

describe("isMode", () => {
  it("returns true for built-in mode names", () => {
    expect(isMode("sourceOnly")).toBe(true);
    expect(isMode("silent")).toBe(true);
    expect(isMode("raw")).toBe(true);
  });

  it("returns false for non-mode names", () => {
    expect(isMode("preview")).toBe(false); // preview is no longer a mode
    expect(isMode("dom")).toBe(false); // dom is handled by ModePlugin, not WrapperFactory
    expect(isMode("withTabs")).toBe(false);
    expect(isMode("unknown")).toBe(false);
    expect(isMode("")).toBe(false);
  });
});

describe("registerBuiltinModes", () => {
  it("registers all modes with global registry", () => {
    registerBuiltinModes();

    expect(globalRegistry.has("sourceOnly")).toBe(true);
    expect(globalRegistry.has("silent")).toBe(true);
    expect(globalRegistry.has("raw")).toBe(true);
  });
});
