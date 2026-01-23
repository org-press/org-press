import { describe, test, expect } from "vitest";
import excalidrawPlugin from "../dist/plugin.js";

describe("excalidrawPlugin", () => {
  test("should export plugin with correct name", () => {
    expect(excalidrawPlugin.name).toBe("excalidraw");
  });

  test("should have a transform function", () => {
    expect(typeof excalidrawPlugin.transform).toBe("function");
  });

  test("should have defaultExtension set to js", () => {
    expect(excalidrawPlugin.defaultExtension).toBe("js");
  });

  test("transform should return code for JSON mode", async () => {
    const block = {
      language: "json",
      value: '{"type":"excalidraw","version":2,"elements":[]}',
      meta: ":use excalidraw",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await excalidrawPlugin.transform(block as any, context as any);

    expect(result.code).toContain("import renderExcalidraw from '@org-press/block-excalidraw/wrapper'");
    expect(result.code).toContain("export default function render(containerId)");
  });

  test("transform should return code for JavaScript mode", async () => {
    const block = {
      language: "javascript",
      value: 'export default { type: "excalidraw", elements: [] }',
      meta: ":use excalidraw",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await excalidrawPlugin.transform(block as any, context as any);

    expect(result.code).toContain("import renderExcalidraw from '@org-press/block-excalidraw/wrapper'");
    expect(result.code).toContain("virtual:org-press:block:excalidraw-data:");
  });

  test("transform should handle sourceOnly mode", async () => {
    const block = {
      language: "json",
      value: '{"type":"excalidraw","version":2,"elements":[]}',
      meta: ":use excalidraw|sourceOnly",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await excalidrawPlugin.transform(block as any, context as any);

    // Should return code for display only, not render function
    expect(result.code).toContain("// Excalidraw diagram source (display only)");
    expect(result.code).toContain("export default");
    expect(result.code).not.toContain("renderExcalidraw");
    expect(result.code).not.toContain("function render");
  });

  test("transform should use custom height parameter", async () => {
    const block = {
      language: "json",
      value: '{"type":"excalidraw","version":2,"elements":[]}',
      meta: ":use excalidraw :height 800px",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await excalidrawPlugin.transform(block as any, context as any);

    expect(result.code).toContain("height: 800px");
  });
});
