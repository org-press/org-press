import { describe, test, expect } from "vitest";
import excalidrawPlugin from "./dist/plugin.js";

describe("excalidrawPlugin", () => {
  test("should export plugin with correct name", () => {
    expect(excalidrawPlugin.name).toBe("block:excalidraw");
  });

  test("should have _type set to block", () => {
    expect(excalidrawPlugin._type).toBe("block");
  });

  test("should have _config with transform function", () => {
    expect(excalidrawPlugin._config).toBeDefined();
    expect(typeof excalidrawPlugin._config.transform).toBe("function");
  });

  test("transform should return code for JSON mode", async () => {
    const code = '{"type":"excalidraw","version":2,"elements":[]}';
    const ctx = {
      blockId: "test-block-0",
      language: "json",
      params: { use: "excalidraw" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await excalidrawPlugin._config.transform(code, ctx);

    expect(result.code).toContain("import renderExcalidraw from '@org-press/block-excalidraw/wrapper'");
    expect(result.code).toContain("export default function render(containerId)");
  });

  test("transform should return code for JavaScript mode", async () => {
    const code = 'export default { type: "excalidraw", elements: [] }';
    const ctx = {
      blockId: "test-block-0",
      language: "javascript",
      params: { use: "excalidraw" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await excalidrawPlugin._config.transform(code, ctx);

    expect(result.code).toContain("import renderExcalidraw from '@org-press/block-excalidraw/wrapper'");
    expect(result.code).toContain("virtual:org-press:block:excalidraw-data:");
  });

  test("transform should handle sourceOnly mode", async () => {
    const code = '{"type":"excalidraw","version":2,"elements":[]}';
    const ctx = {
      blockId: "test-block-0",
      language: "json",
      params: { use: "excalidraw|sourceOnly" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await excalidrawPlugin._config.transform(code, ctx);

    // Should return code for display only, not render function
    expect(result.code).toContain("// Excalidraw diagram source (display only)");
    expect(result.code).toContain("export default");
    expect(result.code).not.toContain("renderExcalidraw");
    expect(result.code).not.toContain("function render");
  });

  test("transform should use custom height parameter", async () => {
    const code = '{"type":"excalidraw","version":2,"elements":[]}';
    const ctx = {
      blockId: "test-block-0",
      language: "json",
      params: { use: "excalidraw", height: "800px" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await excalidrawPlugin._config.transform(code, ctx);

    expect(result.code).toContain("height: 800px");
  });
});
