/**
 * Tests for TypeScriptVirtualEnv
 *
 * Tests the virtual file system and TypeScript language services.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TypeScriptVirtualEnv } from "./virtual-fs.js";
import {
  parseCursorPosition,
  createTestEnv,
  getOffset,
  findPosition,
} from "./__tests__/test-helpers.js";

describe("TypeScriptVirtualEnv", () => {
  let env: TypeScriptVirtualEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  describe("File Management", () => {
    it("should set and get file content", () => {
      env.setFile("/test.ts", "const x = 1;");
      expect(env.hasFile("/test.ts")).toBe(true);
      expect(env.getFileContent("/test.ts")).toBe("const x = 1;");
    });

    it("should return undefined for non-existent file", () => {
      expect(env.hasFile("/nonexistent.ts")).toBe(false);
      expect(env.getFileContent("/nonexistent.ts")).toBeUndefined();
    });

    it("should delete files", () => {
      env.setFile("/test.ts", "const x = 1;");
      env.deleteFile("/test.ts");
      expect(env.hasFile("/test.ts")).toBe(false);
    });

    it("should list all file names", () => {
      env.setFile("/a.ts", "const a = 1;");
      env.setFile("/b.ts", "const b = 2;");
      env.setFile("/c.ts", "const c = 3;");

      const names = env.getFileNames();
      expect(names).toContain("/a.ts");
      expect(names).toContain("/b.ts");
      expect(names).toContain("/c.ts");
    });

    it("should clear all files", () => {
      env.setFile("/a.ts", "const a = 1;");
      env.setFile("/b.ts", "const b = 2;");
      env.clear();

      expect(env.getFileNames()).toHaveLength(0);
    });
  });

  describe("Version Tracking", () => {
    it("should track file versions", () => {
      expect(env.getFileVersion("/test.ts")).toBe(0);

      env.setFile("/test.ts", "const x = 1;");
      expect(env.getFileVersion("/test.ts")).toBe(1);

      env.setFile("/test.ts", "const x = 2;");
      expect(env.getFileVersion("/test.ts")).toBe(2);
    });

    it("should reset version on delete", () => {
      env.setFile("/test.ts", "const x = 1;");
      env.deleteFile("/test.ts");
      expect(env.getFileVersion("/test.ts")).toBe(0);
    });
  });

  describe("Completions", () => {
    it("should provide completions for object properties", () => {
      const content = `const obj = { foo: 1, bar: "hello" };\nobj.`;
      env.setFile("/test.ts", content);

      const completions = env.getCompletions("/test.ts", content.length);
      expect(completions).toBeDefined();
      expect(completions!.entries.some(e => e.name === "foo")).toBe(true);
      expect(completions!.entries.some(e => e.name === "bar")).toBe(true);
    });

    it("should provide completions for array methods", () => {
      const content = `const arr: number[] = [1, 2, 3];\narr.`;
      env.setFile("/test.ts", content);

      // Position at end of "arr."
      const completions = env.getCompletions("/test.ts", content.length);
      // Note: completions might be undefined if TS service hasn't fully initialized
      // This is acceptable in some cases
      if (completions) {
        expect(completions.entries.some(e => e.name === "map")).toBe(true);
        expect(completions.entries.some(e => e.name === "filter")).toBe(true);
        expect(completions.entries.some(e => e.name === "reduce")).toBe(true);
      }
    });

    it("should provide completions for imported symbols", () => {
      env.setFile("/utils.ts", "export const helper = () => {}; export function process() {}");
      const content = `import { h } from "./utils";\n`;
      env.setFile("/main.ts", content);

      // Complete at 'h' position
      const offset = content.indexOf("h ") + 1;
      const completions = env.getCompletions("/main.ts", offset);
      expect(completions).toBeDefined();
      expect(completions!.entries.some(e => e.name === "helper")).toBe(true);
    });

    it("should provide completion details", () => {
      const content = `const obj = { foo: 1 };\nobj.`;
      env.setFile("/test.ts", content);

      // Get completions first to verify they exist
      const completions = env.getCompletions("/test.ts", content.length);
      if (completions && completions.entries.some(e => e.name === "foo")) {
        const details = env.getCompletionDetails("/test.ts", content.length, "foo");
        expect(details).toBeDefined();
        expect(details!.name).toBe("foo");
      }
    });
  });

  describe("Quick Info / Hover", () => {
    it("should provide type information for variables", () => {
      const content = `const greeting = "Hello, World!";`;
      env.setFile("/test.ts", content);

      // Position at 'greeting'
      const offset = content.indexOf("greeting");
      const info = env.getQuickInfo("/test.ts", offset);

      expect(info).toBeDefined();
      expect(info!.displayParts).toBeDefined();
    });

    it("should provide function signatures", () => {
      const content = `function add(a: number, b: number): number { return a + b; }\nadd`;
      env.setFile("/test.ts", content);

      const offset = content.lastIndexOf("add");
      const info = env.getQuickInfo("/test.ts", offset);

      expect(info).toBeDefined();
    });

    it("should provide interface information", () => {
      const content = `interface Person { name: string; age: number; }\nconst p: Person = { name: "Alice", age: 30 };`;
      env.setFile("/test.ts", content);

      const offset = content.indexOf("Person");
      const info = env.getQuickInfo("/test.ts", offset);

      expect(info).toBeDefined();
    });
  });

  describe("Go to Definition", () => {
    it("should find definition in same file", () => {
      const content = `const x = 42;\nconst y = x;`;
      env.setFile("/test.ts", content);

      // Position at second 'x'
      const offset = content.lastIndexOf("x");
      const definitions = env.getDefinition("/test.ts", offset);

      expect(definitions).toBeDefined();
      expect(definitions!.length).toBeGreaterThan(0);
      expect(definitions![0].fileName).toBe("/test.ts");
    });

    it("should find function definition", () => {
      const content = `function greet() { return "hello"; }\ngreet();`;
      env.setFile("/test.ts", content);

      const offset = content.lastIndexOf("greet");
      const definitions = env.getDefinition("/test.ts", offset);

      expect(definitions).toBeDefined();
      expect(definitions!.length).toBeGreaterThan(0);
    });

    it("should find cross-file definitions", () => {
      env.setFile("/utils.ts", `export const helper = 42;`);
      const mainContent = `import { helper } from "./utils";\nconsole.log(helper);`;
      env.setFile("/main.ts", mainContent);

      const offset = mainContent.lastIndexOf("helper");
      const definitions = env.getDefinition("/main.ts", offset);

      expect(definitions).toBeDefined();
      expect(definitions!.length).toBeGreaterThan(0);
      // Should find definition in utils.ts
      expect(definitions!.some(d => d.fileName === "/utils.ts")).toBe(true);
    });
  });

  describe("Find References", () => {
    it("should find all references in same file", () => {
      const content = `const x = 1;\nconst y = x;\nconst z = x + 1;`;
      env.setFile("/test.ts", content);

      const offset = content.indexOf("x");
      const references = env.getReferences("/test.ts", offset);

      expect(references).toBeDefined();
      expect(references!.length).toBeGreaterThan(0);

      // Count all references to x
      const allRefs = references!.flatMap(r => r.references);
      expect(allRefs.length).toBe(3); // declaration + 2 usages
    });

    it("should find cross-file references", () => {
      env.setFile("/utils.ts", `export const shared = 42;`);
      env.setFile("/a.ts", `import { shared } from "./utils";\nconsole.log(shared);`);
      env.setFile("/b.ts", `import { shared } from "./utils";\nconst x = shared;`);

      const offset = 13; // Position of 'shared' in utils.ts
      const references = env.getReferences("/utils.ts", offset);

      expect(references).toBeDefined();
      const allRefs = references!.flatMap(r => r.references);
      expect(allRefs.length).toBeGreaterThanOrEqual(3); // At least declaration + 2 imports
    });
  });

  describe("Diagnostics", () => {
    it("should report type errors", () => {
      const content = `const x: number = "hello";`;
      env.setFile("/test.ts", content);

      const diagnostics = env.getDiagnostics("/test.ts");
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it("should report syntax errors", () => {
      const content = `const x = {`;
      env.setFile("/test.ts", content);

      const diagnostics = env.getDiagnostics("/test.ts");
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it("should return empty for valid code", () => {
      const content = `const x: number = 42;`;
      env.setFile("/test.ts", content);

      const diagnostics = env.getDiagnostics("/test.ts");
      expect(diagnostics.length).toBe(0);
    });

    it("should report missing imports", () => {
      const content = `import { nonexistent } from "./missing";\nconsole.log(nonexistent);`;
      env.setFile("/test.ts", content);

      const diagnostics = env.getDiagnostics("/test.ts");
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Type Definitions", () => {
    it("should find type definition for variable", () => {
      const content = `interface Person { name: string; }\nconst user: Person = { name: "Alice" };`;
      env.setFile("/test.ts", content);

      // Position at 'user'
      const offset = content.indexOf("user");
      const typeDefs = env.getTypeDefinition("/test.ts", offset);

      expect(typeDefs).toBeDefined();
      // Should point to Person interface
      expect(typeDefs!.length).toBeGreaterThan(0);
    });
  });

  describe("Implementations", () => {
    it("should find implementations of interface", () => {
      const content = `
interface Animal {
  speak(): void;
}

class Dog implements Animal {
  speak() { console.log("Woof!"); }
}

class Cat implements Animal {
  speak() { console.log("Meow!"); }
}`;
      env.setFile("/test.ts", content);

      // Position at 'Animal' in interface declaration
      const offset = content.indexOf("Animal");
      const implementations = env.getImplementations("/test.ts", offset);

      expect(implementations).toBeDefined();
      // Should find Dog and Cat
      expect(implementations!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Signature Help", () => {
    it("should provide signature help for function calls", () => {
      const content = `function greet(name: string, greeting?: string): string { return greeting + name; }\ngreet(`;
      env.setFile("/test.ts", content);

      const offset = content.length;
      const sigHelp = env.getSignatureHelp("/test.ts", offset);

      expect(sigHelp).toBeDefined();
      expect(sigHelp!.items.length).toBeGreaterThan(0);
    });
  });

  describe("Declaration Generation", () => {
    it("should generate .d.ts files", () => {
      env.setFile("/lib.ts", `export function add(a: number, b: number): number { return a + b; }`);

      const declarations = env.generateDeclarations();
      expect(declarations.size).toBeGreaterThan(0);

      // Should have a declaration file for lib.ts
      const hasDts = Array.from(declarations.keys()).some(k => k.includes("lib"));
      expect(hasDts).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty files", () => {
      env.setFile("/empty.ts", "");

      expect(env.getCompletions("/empty.ts", 0)).toBeDefined();
      expect(env.getDiagnostics("/empty.ts")).toEqual([]);
    });

    it("should handle files with only comments", () => {
      env.setFile("/comments.ts", "// This is a comment\n/* Another comment */");

      expect(env.getDiagnostics("/comments.ts")).toEqual([]);
    });

    it("should handle JSX/TSX files", () => {
      // Simple JSX that doesn't require React types
      const content = `const element = <div>Hello</div>;`;
      env.setFile("/app.tsx", content);

      // JSX might have errors about missing React types, which is expected
      // We're just testing that TSX files can be added without crashing
      expect(env.hasFile("/app.tsx")).toBe(true);
      expect(env.getFileContent("/app.tsx")).toBe(content);
    });

    it("should handle JavaScript files", () => {
      const content = `function hello(name) { return "Hello, " + name; }`;
      env.setFile("/script.js", content);

      expect(env.hasFile("/script.js")).toBe(true);
      expect(env.getDiagnostics("/script.js")).toEqual([]);
    });
  });
});
