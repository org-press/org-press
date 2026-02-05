import { describe, test, expect } from "vitest";
import { plugin as jscadPlugin } from "./dist/index.js";

describe("jscadPlugin", () => {
  test("should export plugin with correct name", () => {
    expect(jscadPlugin.name).toBe("block:jscad");
  });

  test("should have _type set to block", () => {
    expect(jscadPlugin._type).toBe("block");
  });

  test("should have _config with transform function", () => {
    expect(jscadPlugin._config).toBeDefined();
    expect(typeof jscadPlugin._config.transform).toBe("function");
  });

  test("transform should return code for JavaScript mode", async () => {
    const code = 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();';
    const ctx = {
      blockId: "test-block-0",
      language: "javascript",
      params: { use: "jscad" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await jscadPlugin._config.transform(code, ctx);

    expect(result.code).toContain("import renderJSCad from '@org-press/block-jscad/wrapper'");
    expect(result.code).toContain("export default function render(containerId)");
    expect(result.code).toContain("virtual:org-press:block:jscad-model:");
  });

  test("transform should handle sourceOnly mode", async () => {
    const code = 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();';
    const ctx = {
      blockId: "test-block-0",
      language: "javascript",
      params: { use: "jscad|sourceOnly" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await jscadPlugin._config.transform(code, ctx);

    // Should return code for display only, not render function
    expect(result.code).toContain("// JSCad model source (display only)");
    expect(result.code).toContain("export default");
    expect(result.code).not.toContain("renderJSCad");
    expect(result.code).not.toContain("function render");
  });

  test("transform should use custom height parameter", async () => {
    const code = 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();';
    const ctx = {
      blockId: "test-block-0",
      language: "javascript",
      params: { use: "jscad", height: "600px" },
      orgFilePath: "/test/file.org",
      blockIndex: 0,
      base: "/",
    };

    const result = await jscadPlugin._config.transform(code, ctx);

    expect(result.code).toContain("height: 600px");
  });
});
