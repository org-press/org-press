import { describe, test, expect } from "vitest";
import { plugin as jscadPlugin } from "../dist/index.js";

describe("jscadPlugin", () => {
  test("should export plugin with correct name", () => {
    expect(jscadPlugin.name).toBe("jscad");
  });

  test("should have a transform function", () => {
    expect(typeof jscadPlugin.transform).toBe("function");
  });

  test("should have defaultExtension set to js", () => {
    expect(jscadPlugin.defaultExtension).toBe("js");
  });

  test("transform should return code for JavaScript mode", async () => {
    const block = {
      language: "javascript",
      value: 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();',
      meta: ":use jscad",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await jscadPlugin.transform(block as any, context as any);

    expect(result.code).toContain("import renderJSCad from '@org-press/block-jscad/wrapper'");
    expect(result.code).toContain("export default function render(containerId)");
    expect(result.code).toContain("virtual:org-press:block:jscad-model:");
  });

  test("transform should handle sourceOnly mode", async () => {
    const block = {
      language: "javascript",
      value: 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();',
      meta: ":use jscad|sourceOnly",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await jscadPlugin.transform(block as any, context as any);

    // Should return code for display only, not render function
    expect(result.code).toContain("// JSCad model source (display only)");
    expect(result.code).toContain("export default");
    expect(result.code).not.toContain("renderJSCad");
    expect(result.code).not.toContain("function render");
  });

  test("transform should use custom height parameter", async () => {
    const block = {
      language: "javascript",
      value: 'import { cube } from "@jscad/modeling/src/primitives"; export default cube();',
      meta: ":use jscad :height 600px",
    };
    const context = {
      orgFilePath: "/test/file.org",
      blockIndex: 0,
    };

    const result = await jscadPlugin.transform(block as any, context as any);

    expect(result.code).toContain("height: 600px");
  });
});
