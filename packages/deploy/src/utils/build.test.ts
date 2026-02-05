/**
 * Build utilities tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import {
  buildPackage,
  transpileCode,
  listDirectory,
  formatBytes,
} from "./build.ts";
import type { PackageMetadata, NamedBlock, DeployLogger } from "../types.ts";

describe("transpileCode", () => {
  it("should pass through JavaScript unchanged", () => {
    const code = `export const foo = "bar";`;
    expect(transpileCode(code, "javascript")).toBe(code);
  });

  it("should strip type imports", () => {
    const code = `import type { Foo } from "./types";
export const x = 1;`;
    const result = transpileCode(code, "typescript");
    expect(result).not.toContain("import type");
    expect(result).toContain("export const x = 1;");
  });

  it("should strip type annotations from variables", () => {
    const code = `const x: number = 1;`;
    const result = transpileCode(code, "typescript");
    expect(result).not.toContain(": number");
    expect(result).toContain("const x = 1;");
  });

  it("should handle ts and tsx languages", () => {
    const code = `const x: string = "hello";`;
    expect(transpileCode(code, "ts")).not.toContain(": string");
    expect(transpileCode(code, "tsx")).not.toContain(": string");
  });
});

describe("formatBytes", () => {
  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
});

describe("buildPackage", () => {
  const testDir = path.join(process.cwd(), ".test-build-pkg");

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should create output directory and files", async () => {
    const source = `#+TITLE: test-pkg

* Overview

Test package.
`;
    const ast = parse(source) as OrgData;

    const metadata: PackageMetadata = {
      name: "test-pkg",
      version: "1.0.0",
      description: "A test package",
      license: "MIT",
    };

    const namedBlocks: NamedBlock[] = [
      {
        name: "main",
        language: "javascript",
        code: `export const foo = "bar";`,
      },
    ];

    // Create a silent logger
    const logs: string[] = [];
    const logger: DeployLogger = {
      info: (msg) => logs.push(msg),
      warn: (msg) => logs.push(`WARN: ${msg}`),
      error: (msg) => logs.push(`ERROR: ${msg}`),
      debug: () => {},
    };

    const result = await buildPackage(testDir, ast, metadata, namedBlocks, {
      logger,
    });

    expect(result.outDir).toBe(testDir);
    expect(result.files).toContain("dist/index.js");
    expect(result.files).toContain("package.json");
    expect(result.files).toContain("README.md");

    // Verify files exist
    expect(fs.existsSync(path.join(testDir, "dist", "index.js"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "README.md"))).toBe(true);

    // Verify package.json content
    const pkg = JSON.parse(
      fs.readFileSync(path.join(testDir, "package.json"), "utf-8")
    );
    expect(pkg.name).toBe("test-pkg");
    expect(pkg.version).toBe("1.0.0");
  });

  it("should skip README when noReadme is true", async () => {
    const source = `#+TITLE: test-pkg`;
    const ast = parse(source) as OrgData;

    const metadata: PackageMetadata = {
      name: "test-pkg",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      {
        name: "main",
        language: "javascript",
        code: `export default {};`,
      },
    ];

    const logger: DeployLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const result = await buildPackage(testDir, ast, metadata, namedBlocks, {
      noReadme: true,
      logger,
    });

    expect(result.files).not.toContain("README.md");
    expect(fs.existsSync(path.join(testDir, "README.md"))).toBe(false);
  });

  it("should handle multiple named blocks", async () => {
    const source = `#+TITLE: multi-block`;
    const ast = parse(source) as OrgData;

    const metadata: PackageMetadata = {
      name: "multi-block",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      {
        name: "main",
        language: "javascript",
        code: `export * from "./utils.js";`,
      },
      {
        name: "utils",
        language: "javascript",
        code: `export function helper() { return 42; }`,
      },
    ];

    const logger: DeployLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const result = await buildPackage(testDir, ast, metadata, namedBlocks, {
      logger,
    });

    expect(result.files).toContain("dist/index.js");
    expect(result.files).toContain("dist/utils.js");
    expect(fs.existsSync(path.join(testDir, "dist", "utils.js"))).toBe(true);
  });

  it("should transpile TypeScript to JavaScript", async () => {
    const source = `#+TITLE: ts-pkg`;
    const ast = parse(source) as OrgData;

    const metadata: PackageMetadata = {
      name: "ts-pkg",
      version: "1.0.0",
    };

    const namedBlocks: NamedBlock[] = [
      {
        name: "main",
        language: "typescript",
        code: `const x: number = 42;
export default x;`,
      },
    ];

    const logger: DeployLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    await buildPackage(testDir, ast, metadata, namedBlocks, { logger });

    const output = fs.readFileSync(
      path.join(testDir, "dist", "index.js"),
      "utf-8"
    );
    expect(output).not.toContain(": number");
    expect(output).toContain("const x = 42;");
  });
});

describe("listDirectory", () => {
  const testDir = path.join(process.cwd(), ".test-list-dir");

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(testDir, "file.txt"), "hello");
    fs.writeFileSync(path.join(testDir, "subdir", "nested.txt"), "world");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should list directory contents recursively", () => {
    const lines = listDirectory(testDir);

    expect(lines.some((l) => l.includes("file.txt"))).toBe(true);
    expect(lines.some((l) => l.includes("subdir/"))).toBe(true);
    expect(lines.some((l) => l.includes("nested.txt"))).toBe(true);
  });
});
