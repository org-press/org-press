// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { executeServerBlock, createContentHelpers } from "./execute.ts";

const mockContentHelpers = createContentHelpers(
  vi.fn().mockResolvedValue([]),
  vi.fn().mockResolvedValue([]),
  vi.fn().mockReturnValue("<ul></ul>"),
  vi.fn().mockReturnValue(false)
);

describe("ES Module Server Execution", () => {
  it("should error on legacy return statement code", async () => {
    const result = await executeServerBlock("return 42", "javascript", mockContentHelpers);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain("Return statement");
  });

  it("should execute ES module with export default", async () => {
    const result = await executeServerBlock(
      "export default 'hello'",
      "javascript",
      mockContentHelpers
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("hello");
  });

  it("should transpile TypeScript", async () => {
    const result = await executeServerBlock(
      `
      interface Point { x: number; y: number; }
      const p: Point = { x: 1, y: 2 };
      export default p.x + p.y;
      `,
      "typescript",
      mockContentHelpers
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("3");
  });

  it("should handle async code", async () => {
    const result = await executeServerBlock(
      `
      await new Promise(r => setTimeout(r, 10));
      export default "async done";
      `,
      "javascript",
      mockContentHelpers
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("async done");
  });

  it("should provide access to content helpers", async () => {
    const helpers = createContentHelpers(
      vi.fn().mockResolvedValue([{ title: "A" }, { title: "B" }]),
      vi.fn().mockResolvedValue([]),
      vi.fn().mockReturnValue(""),
      vi.fn().mockReturnValue(false)
    );

    const result = await executeServerBlock(
      "const pages = await content.getContentPages(); export default pages.length;",
      "javascript",
      helpers
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("2");
  });

  it("should return empty output when no export default", async () => {
    const result = await executeServerBlock(
      "const x = 42; console.log(x);",
      "javascript",
      mockContentHelpers
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("");
  });

  it("should capture execution errors", async () => {
    const result = await executeServerBlock(
      "throw new Error('Test error')",
      "javascript",
      mockContentHelpers
    );
    expect(result.error).toBeDefined();
    expect(result.error!.message).toBe("Test error");
  });
});
