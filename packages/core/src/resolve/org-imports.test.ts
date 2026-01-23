/**
 * Tests for Org Import Resolution
 */

import { describe, it, expect } from "vitest";
import {
  isOrgImport,
  parseOrgImportQuery,
  resolveOrgPath,
  resolveOrgImport,
} from "./org-imports.js";
import type { BlockManifest, BlockInfo } from "../dts/types.js";

/**
 * Create a mock BlockInfo
 */
function createMockBlock(options: {
  name: string;
  orgFilePath: string;
  index?: number;
  language?: string;
}): BlockInfo {
  return {
    id: `${options.orgFilePath}:${options.index || 0}`,
    name: options.name,
    orgFilePath: options.orgFilePath,
    index: options.index || 0,
    language: options.language || "typescript",
    startLine: 5,
    endLine: 10,
    startColumn: 0,
    parameters: {},
    virtualModuleId: `virtual:org-press:block:default:${options.orgFilePath}:NAME:${options.name}.ts`,
    content: "// mock content",
  };
}

/**
 * Create a mock BlockManifest
 */
function createMockManifest(
  files: Record<string, Array<{ name: string; language?: string }>>
): BlockManifest {
  const blocksByFile = new Map<string, BlockInfo[]>();
  const blocksByVirtualId = new Map<string, BlockInfo>();

  for (const [filePath, blocks] of Object.entries(files)) {
    const blockInfos = blocks.map((b, i) =>
      createMockBlock({
        name: b.name,
        orgFilePath: filePath,
        index: i,
        language: b.language,
      })
    );
    blocksByFile.set(filePath, blockInfos);
    for (const block of blockInfos) {
      blocksByVirtualId.set(block.virtualModuleId, block);
    }
  }

  return {
    blocksByFile,
    blocksByVirtualId,
    projectRoot: "/project",
    contentDir: "/project/content",
  };
}

describe("isOrgImport", () => {
  it("should return true for .org?name= imports", () => {
    expect(isOrgImport("./file.org?name=block")).toBe(true);
    expect(isOrgImport("../lib.org?name=utils")).toBe(true);
    expect(isOrgImport("/shared.org?name=config")).toBe(true);
  });

  it("should return true for bare .org imports", () => {
    expect(isOrgImport("./file.org")).toBe(true);
    expect(isOrgImport("file.org")).toBe(true);
  });

  it("should return false for non-org imports", () => {
    expect(isOrgImport("./file.ts")).toBe(false);
    expect(isOrgImport("lodash")).toBe(false);
    expect(isOrgImport("@org-press/core")).toBe(false);
  });
});

describe("parseOrgImportQuery", () => {
  it("should parse valid ?name= imports", () => {
    const result = parseOrgImportQuery("./lib.org?name=utils");
    expect(result).toEqual({
      orgPath: "./lib.org",
      blockName: "utils",
      isDataImport: false,
    });
  });

  it("should parse imports with data flag", () => {
    const result = parseOrgImportQuery("./file.org?name=block&data");
    expect(result).toEqual({
      orgPath: "./file.org",
      blockName: "block",
      isDataImport: true,
    });
  });

  it("should parse absolute paths", () => {
    const result = parseOrgImportQuery("/shared.org?name=config");
    expect(result).toEqual({
      orgPath: "/shared.org",
      blockName: "config",
      isDataImport: false,
    });
  });

  it("should parse parent directory paths", () => {
    const result = parseOrgImportQuery("../utils/math.org?name=add");
    expect(result).toEqual({
      orgPath: "../utils/math.org",
      blockName: "add",
      isDataImport: false,
    });
  });

  it("should return null for imports without ?name=", () => {
    expect(parseOrgImportQuery("./file.org")).toBeNull();
    expect(parseOrgImportQuery("./file.org?index=0")).toBeNull();
    expect(parseOrgImportQuery("./file.org?data")).toBeNull();
  });

  it("should return null for non-org imports", () => {
    expect(parseOrgImportQuery("./file.ts")).toBeNull();
    expect(parseOrgImportQuery("lodash")).toBeNull();
  });

  it("should handle special characters in block names", () => {
    const result = parseOrgImportQuery("./file.org?name=my-block_v2");
    expect(result?.blockName).toBe("my-block_v2");
  });
});

describe("resolveOrgPath", () => {
  const contentDir = "/project/content";

  it("should resolve absolute paths from content root", () => {
    expect(resolveOrgPath("/shared.org", undefined, contentDir)).toBe("shared.org");
    expect(resolveOrgPath("/utils/math.org", undefined, contentDir)).toBe("utils/math.org");
  });

  it("should resolve relative paths from org file importer", () => {
    expect(resolveOrgPath("./utils.org", "pages/index.org", contentDir)).toBe(
      "pages/utils.org"
    );
    expect(resolveOrgPath("../shared.org", "pages/sub/page.org", contentDir)).toBe(
      "pages/shared.org"
    );
  });

  it("should resolve relative paths from virtual module importer", () => {
    const virtualImporter = "virtual:org-press:block:default:pages/index.org:NAME:main.ts";
    expect(resolveOrgPath("./utils.org", virtualImporter, contentDir)).toBe(
      "pages/utils.org"
    );
  });

  it("should return null for relative paths without importer", () => {
    expect(resolveOrgPath("./file.org", undefined, contentDir)).toBeNull();
    expect(resolveOrgPath("../file.org", undefined, contentDir)).toBeNull();
  });

  it("should handle deeply nested paths", () => {
    expect(
      resolveOrgPath("../../shared/utils.org", "pages/blog/posts/article.org", contentDir)
    ).toBe("pages/shared/utils.org");
  });
});

describe("resolveOrgImport", () => {
  const contentDir = "/project/content";

  it("should resolve valid imports", () => {
    const manifest = createMockManifest({
      "utils.org": [{ name: "helpers" }],
    });

    const result = resolveOrgImport(
      "./utils.org?name=helpers",
      "index.org",
      contentDir,
      manifest
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved.orgFilePath).toBe("utils.org");
      expect(result.resolved.block.name).toBe("helpers");
      expect(result.resolved.extension).toBe("ts");
      expect(result.resolved.virtualModuleId).toContain("helpers");
    }
  });

  it("should resolve absolute path imports", () => {
    const manifest = createMockManifest({
      "shared/config.org": [{ name: "settings" }],
    });

    const result = resolveOrgImport(
      "/shared/config.org?name=settings",
      "pages/index.org",
      contentDir,
      manifest
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved.orgFilePath).toBe("shared/config.org");
    }
  });

  it("should resolve parent directory imports", () => {
    const manifest = createMockManifest({
      "shared/utils.org": [{ name: "math" }],
    });

    const result = resolveOrgImport(
      "../shared/utils.org?name=math",
      "pages/index.org",
      contentDir,
      manifest
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved.orgFilePath).toBe("shared/utils.org");
    }
  });

  it("should return error for missing ?name= parameter", () => {
    const manifest = createMockManifest({
      "utils.org": [{ name: "helpers" }],
    });

    const result = resolveOrgImport("./utils.org", "index.org", contentDir, manifest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_NAME");
    }
  });

  it("should return error for non-existent org file", () => {
    const manifest = createMockManifest({});

    const result = resolveOrgImport(
      "./missing.org?name=block",
      "index.org",
      contentDir,
      manifest
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ORG_FILE_NOT_FOUND");
    }
  });

  it("should return error for non-existent block", () => {
    const manifest = createMockManifest({
      "utils.org": [{ name: "helpers" }],
    });

    const result = resolveOrgImport(
      "./utils.org?name=nonexistent",
      "index.org",
      contentDir,
      manifest
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BLOCK_NOT_FOUND");
    }
  });

  it("should use correct extension based on language", () => {
    const manifest = createMockManifest({
      "components.org": [
        { name: "button", language: "tsx" },
        { name: "styles", language: "javascript" },
      ],
    });

    const tsxResult = resolveOrgImport(
      "./components.org?name=button",
      "index.org",
      contentDir,
      manifest
    );
    expect(tsxResult.ok && tsxResult.resolved.extension).toBe("tsx");

    const jsResult = resolveOrgImport(
      "./components.org?name=styles",
      "index.org",
      contentDir,
      manifest
    );
    expect(jsResult.ok && jsResult.resolved.extension).toBe("js");
  });

  it("should resolve from virtual module importer", () => {
    const manifest = createMockManifest({
      "pages/utils.org": [{ name: "helpers" }],
    });

    const virtualImporter = "virtual:org-press:block:default:pages/index.org:NAME:main.ts";
    const result = resolveOrgImport(
      "./utils.org?name=helpers",
      virtualImporter,
      contentDir,
      manifest
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved.orgFilePath).toBe("pages/utils.org");
    }
  });
});
