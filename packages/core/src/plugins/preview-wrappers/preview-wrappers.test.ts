/**
 * Tests for built-in preview wrappers
 */

import { describe, it, expect } from "vitest";
import { withSourceCode } from "./with-source-code.ts";
import { withContainer } from "./with-container.ts";
import { withErrorBoundary } from "./with-error-boundary.ts";
import { withConsole } from "./with-console.ts";
import { withCollapse } from "./with-collapse.ts";
import { builtinWrappers, registerBuiltinWrappers } from "./index.ts";
import { globalRegistry } from "../wrapper-compose.ts";
import type { PreviewFn, BlockContext } from "../preview.ts";

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

// Simple preview function for testing
const simplePreview: PreviewFn = (result) => {
  return `<div class="result">${String(result)}</div>`;
};

// Throwing preview function for error boundary testing
const throwingPreview: PreviewFn = () => {
  throw new Error("Test error");
};

describe("withSourceCode", () => {
  it("shows source code after preview by default", () => {
    const wrapper = withSourceCode();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('<div class="result">42</div>');
    expect(result).toContain('<div class="org-source-code">');
    // Source code is HTML-escaped
    expect(result).toContain('console.log(&quot;test&quot;);');
    // Preview should come first (before source)
    expect((result as string).indexOf('<div class="result">')).toBeLessThan(
      (result as string).indexOf('<div class="org-source-code">')
    );
  });

  it("shows source code before preview", () => {
    const wrapper = withSourceCode({ position: "before" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('<div class="result">42</div>');
    expect(result).toContain('<div class="org-source-code">');
    // Source should come first (before preview)
    expect((result as string).indexOf('<div class="org-source-code">')).toBeLessThan(
      (result as string).indexOf('<div class="result">')
    );
  });

  it("shows only source code when position=replace", () => {
    const wrapper = withSourceCode({ position: "replace" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).not.toContain('<div class="result">');
    expect(result).toContain('<div class="org-source-code">');
    // Source code is HTML-escaped
    expect(result).toContain('console.log(&quot;test&quot;);');
  });

  it("uses custom label", () => {
    const wrapper = withSourceCode({ label: "Code" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("Code");
  });

  it("uses custom className", () => {
    const wrapper = withSourceCode({ className: "my-source" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('class="my-source"');
  });

  it("escapes HTML in source code", () => {
    const wrapper = withSourceCode();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext({
      block: {
        language: "html",
        content: "<div>test</div>",
        index: 0,
        headers: {},
      },
    });

    const result = wrapped("42", ctx);

    expect(result).toContain("&lt;div&gt;test&lt;/div&gt;");
  });
});

describe("withContainer", () => {
  it("wraps preview in container with default class", () => {
    const wrapper = withContainer();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('<div class="org-block-container"');
    expect(result).toContain('<div class="result">42</div>');
    expect(result).toContain("</div>");
  });

  it("uses custom className", () => {
    const wrapper = withContainer({ className: "my-container" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('class="my-container"');
  });

  it("adds inline styles", () => {
    const wrapper = withContainer({
      style: { padding: "1rem", backgroundColor: "red" }
    });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('style="');
    expect(result).toContain("padding: 1rem");
    expect(result).toContain("background-color: red");
  });

  it("uses custom tag", () => {
    const wrapper = withContainer({ tag: "section" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("<section");
    expect(result).toContain("</section>");
  });

  it("adds data attributes", () => {
    const wrapper = withContainer({ data: { "test-id": "123" } });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('data-test-id="123"');
  });

  it("adds block metadata as data attributes", () => {
    const wrapper = withContainer();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext({
      block: {
        language: "python",
        content: "print(1)",
        index: 5,
        name: "my-block",
        headers: {},
      },
    });

    const result = wrapped("42", ctx);

    expect(result).toContain('data-block-language="python"');
    expect(result).toContain('data-block-name="my-block"');
    expect(result).toContain('data-block-index="5"');
  });

  it("returns null for null preview result", () => {
    const nullPreview: PreviewFn = () => null;
    const wrapper = withContainer();
    const wrapped = wrapper(nullPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toBeNull();
  });
});

describe("withErrorBoundary", () => {
  it("passes through successful preview", () => {
    const wrapper = withErrorBoundary();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toBe('<div class="result">42</div>');
  });

  it("catches errors and shows fallback", () => {
    const wrapper = withErrorBoundary();
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('class="org-error-boundary"');
    expect(result).toContain('data-error="true"');
    expect(result).toContain("Error rendering preview");
    expect(result).toContain("Test error");
  });

  it("uses custom fallback", () => {
    const wrapper = withErrorBoundary({ fallback: "Oops! {error}" });
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("Oops! Test error");
  });

  it("hides error message when showError=false", () => {
    const wrapper = withErrorBoundary({ showError: false });
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("Error rendering preview");
    expect(result).not.toContain("org-error-message");
  });

  it("shows stack trace in dev mode", () => {
    const wrapper = withErrorBoundary({ showStack: true });
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext({ runtime: { isDev: true } });

    const result = wrapped("42", ctx);

    expect(result).toContain("org-error-stack");
  });

  it("hides stack trace in production", () => {
    const wrapper = withErrorBoundary({ showStack: true });
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext({ runtime: { isDev: false } });

    const result = wrapped("42", ctx);

    expect(result).not.toContain("org-error-stack");
  });

  it("uses custom className", () => {
    const wrapper = withErrorBoundary({ className: "my-error" });
    const wrapped = wrapper(throwingPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('class="my-error"');
  });
});

describe("withConsole", () => {
  it("passes through result without console data", () => {
    const wrapper = withConsole();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toBe('<div class="result">42</div>');
  });

  it("displays console output after preview by default", () => {
    const wrapper = withConsole();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [
        { type: "log" as const, args: ["Hello", "world"] },
        { type: "warn" as const, args: ["Warning!"] },
      ],
    };

    const result = wrapped(resultWithConsole, ctx);

    expect(result).toContain('<div class="result">42</div>');
    expect(result).toContain('<div class="org-console">');
    expect(result).toContain("Hello world");
    expect(result).toContain("Warning!");
    expect(result).toContain("org-console-log");
    expect(result).toContain("org-console-warn");
    // Preview should come first
    expect((result as string).indexOf('<div class="result">')).toBeLessThan(
      (result as string).indexOf('<div class="org-console">')
    );
  });

  it("displays console output before preview", () => {
    const wrapper = withConsole({ position: "before" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [{ type: "log" as const, args: ["Hello"] }],
    };

    const result = wrapped(resultWithConsole, ctx);

    // Console should come first
    expect((result as string).indexOf('<div class="org-console">')).toBeLessThan(
      (result as string).indexOf('<div class="result">')
    );
  });

  it("shows only console output when position=replace", () => {
    const wrapper = withConsole({ position: "replace" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [{ type: "log" as const, args: ["Hello"] }],
    };

    const result = wrapped(resultWithConsole, ctx);

    expect(result).not.toContain('<div class="result">');
    expect(result).toContain('<div class="org-console">');
    expect(result).toContain("Hello");
  });

  it("limits number of lines", () => {
    const wrapper = withConsole({ maxLines: 2 });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [
        { type: "log" as const, args: ["Line 1"] },
        { type: "log" as const, args: ["Line 2"] },
        { type: "log" as const, args: ["Line 3"] },
        { type: "log" as const, args: ["Line 4"] },
      ],
    };

    const result = wrapped(resultWithConsole, ctx);

    // Should show last 2 lines
    expect(result).toContain("Line 3");
    expect(result).toContain("Line 4");
    expect(result).not.toContain("Line 1");
    expect(result).not.toContain("Line 2");
    expect(result).toContain("2 earlier entries hidden");
  });

  it("uses custom className and label", () => {
    const wrapper = withConsole({ className: "my-console", label: "Output" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [{ type: "log" as const, args: ["Hello"] }],
    };

    const result = wrapped(resultWithConsole, ctx);

    expect(result).toContain('class="my-console"');
    expect(result).toContain("Output");
  });

  it("formats different value types", () => {
    const wrapper = withConsole();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [
        { type: "log" as const, args: [null, undefined, true, 123, { a: 1 }] },
      ],
    };

    const result = wrapped(resultWithConsole, ctx);

    expect(result).toContain("null");
    expect(result).toContain("undefined");
    expect(result).toContain("true");
    expect(result).toContain("123");
    // JSON is HTML-escaped
    expect(result).toContain('{&quot;a&quot;:1}');
  });

  it("escapes HTML in console output", () => {
    const wrapper = withConsole();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const resultWithConsole = {
      value: "42",
      console: [{ type: "log" as const, args: ["<script>alert('xss')</script>"] }],
    };

    const result = wrapped(resultWithConsole, ctx);

    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>");
  });
});

describe("withCollapse", () => {
  it("wraps preview in collapsible details element", () => {
    const wrapper = withCollapse();
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('<details class="org-collapse">');
    expect(result).toContain("<summary>Result</summary>");
    expect(result).toContain('<div class="result">42</div>');
    expect(result).toContain("</details>");
  });

  it("uses custom summary", () => {
    const wrapper = withCollapse({ summary: "Click to expand" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("<summary>Click to expand</summary>");
  });

  it("starts expanded when open=true", () => {
    const wrapper = withCollapse({ open: true });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("<details class=\"org-collapse\" open>");
  });

  it("uses block name as summary", () => {
    const wrapper = withCollapse({ useBlockName: true });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext({
      block: {
        language: "typescript",
        content: "code",
        index: 0,
        name: "my-calculation",
        headers: {},
      },
    });

    const result = wrapped("42", ctx);

    expect(result).toContain("<summary>my-calculation</summary>");
  });

  it("falls back to default summary when no block name", () => {
    const wrapper = withCollapse({ useBlockName: true });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("<summary>Result</summary>");
  });

  it("uses custom className", () => {
    const wrapper = withCollapse({ className: "my-collapse" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain('class="my-collapse"');
  });

  it("returns null for null preview result", () => {
    const nullPreview: PreviewFn = () => null;
    const wrapper = withCollapse();
    const wrapped = wrapper(nullPreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toBeNull();
  });

  it("escapes HTML in summary", () => {
    const wrapper = withCollapse({ summary: "<script>bad</script>" });
    const wrapped = wrapper(simplePreview);
    const ctx = createMockContext();

    const result = wrapped("42", ctx);

    expect(result).toContain("&lt;script&gt;");
    expect(result).not.toContain("<script>bad</script>");
  });
});

describe("builtinWrappers", () => {
  it("exports all built-in wrappers", () => {
    expect(builtinWrappers.withSourceCode).toBe(withSourceCode);
    expect(builtinWrappers.withContainer).toBe(withContainer);
    expect(builtinWrappers.withErrorBoundary).toBe(withErrorBoundary);
    expect(builtinWrappers.withConsole).toBe(withConsole);
    expect(builtinWrappers.withCollapse).toBe(withCollapse);
  });
});

describe("registerBuiltinWrappers", () => {
  it("registers all wrappers with global registry", () => {
    registerBuiltinWrappers();

    expect(globalRegistry.has("withSourceCode")).toBe(true);
    expect(globalRegistry.has("withContainer")).toBe(true);
    expect(globalRegistry.has("withErrorBoundary")).toBe(true);
    expect(globalRegistry.has("withConsole")).toBe(true);
    expect(globalRegistry.has("withCollapse")).toBe(true);
  });
});
