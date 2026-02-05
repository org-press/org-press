/**
 * Tests for format wrappers
 */

import { describe, it, expect } from "vitest";
import { jsonFormat } from "./json.ts";
import { yamlFormat } from "./yaml.ts";
import { csvFormat } from "./csv.ts";
import { htmlFormat } from "./html.ts";
import { formatWrappers, registerFormatWrappers, isFormat } from "./index.ts";
import { globalRegistry } from "../wrapper-compose.ts";
import type { RenderFunction, BlockContext } from "../preview.ts";

// Helper to create a mock BlockContext
function createMockContext(): BlockContext {
  return {
    file: {
      path: "/test/file.org",
      relativePath: "file.org",
    },
    block: {
      language: "typescript",
      content: "code",
      index: 0,
      name: undefined,
      headers: {},
    },
    runtime: {
      isDev: false,
    },
  } as BlockContext;
}

// Dummy input render (formats ignore this)
const dummyRender: RenderFunction = () => "<dummy/>";

describe("jsonFormat", () => {
  it("formats objects as JSON", () => {
    const format = jsonFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ name: "Alice", age: 30 }, ctx);

    expect(result).toContain('class="org-json"');
    expect(result).toContain("language-json");
    expect(result).toContain("&quot;name&quot;");
    expect(result).toContain("&quot;Alice&quot;");
    expect(result).toContain("30");
  });

  it("formats arrays as JSON", () => {
    const format = jsonFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped([1, 2, 3], ctx);

    expect(result).toContain("[");
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
    expect(result).toContain("]");
  });

  it("handles null", () => {
    const format = jsonFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(null, ctx);

    expect(result).toContain("null");
  });

  it("returns null for undefined", () => {
    const format = jsonFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(undefined, ctx);

    expect(result).toBeNull();
  });

  it("uses custom indentation", () => {
    const format = jsonFormat({ indent: 4 });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: 1 }, ctx) as string;

    // 4-space indent should have more spaces
    expect(result).toContain("    ");
  });

  it("uses custom className", () => {
    const format = jsonFormat({ className: "my-json" });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: 1 }, ctx);

    expect(result).toContain('class="my-json"');
  });

  it("truncates at maxDepth", () => {
    const format = jsonFormat({ maxDepth: 1 });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: { b: { c: 1 } } }, ctx) as string;

    expect(result).toContain("[Object]");
  });
});

describe("yamlFormat", () => {
  it("formats objects as YAML", () => {
    const format = yamlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ name: "Alice", age: 30 }, ctx);

    expect(result).toContain('class="org-yaml"');
    expect(result).toContain("language-yaml");
    expect(result).toContain("name: Alice");
    expect(result).toContain("age: 30");
  });

  it("formats arrays as YAML", () => {
    const format = yamlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(["a", "b", "c"], ctx);

    expect(result).toContain("- a");
    expect(result).toContain("- b");
    expect(result).toContain("- c");
  });

  it("handles nested objects", () => {
    const format = yamlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ config: { debug: true } }, ctx);

    expect(result).toContain("config:");
    expect(result).toContain("debug: true");
  });

  it("quotes strings that need quoting", () => {
    const format = yamlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ value: "true" }, ctx);

    expect(result).toContain('&quot;true&quot;');
  });

  it("handles null", () => {
    const format = yamlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(null, ctx);

    expect(result).toContain("null");
  });
});

describe("csvFormat", () => {
  it("formats array of objects as CSV", () => {
    const format = csvFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(
      [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ],
      ctx
    );

    expect(result).toContain('class="org-csv"');
    expect(result).toContain("name,age");
    expect(result).toContain("Alice,30");
    expect(result).toContain("Bob,25");
  });

  it("handles custom delimiter", () => {
    const format = csvFormat({ delimiter: ";" });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped([{ a: 1, b: 2 }], ctx);

    expect(result).toContain("a;b");
    expect(result).toContain("1;2");
  });

  it("omits header when configured", () => {
    const format = csvFormat({ header: false });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped([{ name: "Alice" }], ctx);

    expect(result).not.toContain("name\n");
    expect(result).toContain("Alice");
  });

  it("renders as HTML table", () => {
    const format = csvFormat({ asTable: true });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(
      [
        { name: "Alice", age: 30 },
      ],
      ctx
    );

    expect(result).toContain("<table");
    expect(result).toContain("<thead>");
    expect(result).toContain("<th>name</th>");
    expect(result).toContain("<tbody>");
    expect(result).toContain("<td>Alice</td>");
    expect(result).toContain("</table>");
  });

  it("quotes fields with delimiters", () => {
    const format = csvFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped([{ text: "hello, world" }], ctx);

    expect(result).toContain('&quot;hello, world&quot;');
  });

  it("returns error for non-array", () => {
    const format = csvFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped({ a: 1 }, ctx);

    expect(result).toContain("Error");
    expect(result).toContain("requires an array");
  });

  it("returns null for null/undefined", () => {
    const format = csvFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    expect(wrapped(null, ctx)).toBeNull();
    expect(wrapped(undefined, ctx)).toBeNull();
  });
});

describe("htmlFormat", () => {
  it("passes through HTML directly", () => {
    const format = htmlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("<div>hello</div>", ctx);

    expect(result).toBe("<div>hello</div>");
  });

  it("wraps in container when configured", () => {
    const format = htmlFormat({ wrap: true });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("<p>content</p>", ctx);

    expect(result).toContain('class="org-html"');
    expect(result).toContain("<p>content</p>");
    expect(result).toContain("</div>");
  });

  it("uses custom className", () => {
    const format = htmlFormat({ wrap: true, className: "my-html" });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped("<p>content</p>", ctx);

    expect(result).toContain('class="my-html"');
  });

  it("sanitizes HTML when configured", () => {
    const format = htmlFormat({ sanitize: true });
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    const result = wrapped(
      '<div onclick="alert(1)"><script>bad()</script>hello</div>',
      ctx
    ) as string;

    expect(result).not.toContain("<script>");
    expect(result).not.toContain("onclick");
    expect(result).toContain("hello");
  });

  it("returns null for null/undefined", () => {
    const format = htmlFormat();
    const wrapped = format(dummyRender);
    const ctx = createMockContext();

    expect(wrapped(null, ctx)).toBeNull();
    expect(wrapped(undefined, ctx)).toBeNull();
  });
});

describe("formatWrappers", () => {
  it("exports all format wrappers", () => {
    expect(formatWrappers.json).toBe(jsonFormat);
    expect(formatWrappers.yaml).toBe(yamlFormat);
    expect(formatWrappers.csv).toBe(csvFormat);
    expect(formatWrappers.html).toBe(htmlFormat);
  });
});

describe("isFormat", () => {
  it("returns true for format names", () => {
    expect(isFormat("json")).toBe(true);
    expect(isFormat("yaml")).toBe(true);
    expect(isFormat("csv")).toBe(true);
    expect(isFormat("html")).toBe(true);
  });

  it("returns false for non-format names", () => {
    expect(isFormat("xml")).toBe(false);
    expect(isFormat("withTabs")).toBe(false);
    expect(isFormat("")).toBe(false);
  });
});

describe("registerFormatWrappers", () => {
  it("registers all formats with global registry", () => {
    registerFormatWrappers();

    expect(globalRegistry.has("json")).toBe(true);
    expect(globalRegistry.has("yaml")).toBe(true);
    expect(globalRegistry.has("csv")).toBe(true);
    expect(globalRegistry.has("html")).toBe(true);
  });
});
