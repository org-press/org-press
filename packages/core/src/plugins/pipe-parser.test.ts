import { describe, it, expect } from "vitest";
import {
  parsePipe,
  hasPipe,
  getMode,
  getWrappers,
  serializeSegment,
  resolveUse,
  type PipeSegment,
} from "./pipe-parser.ts";

describe("Pipe Parser", () => {
  describe("parsePipe", () => {
    it("should parse simple mode", () => {
      const result = parsePipe("preview");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("preview");
      expect(result[0].config).toBeUndefined();
    });

    it("should parse mode with single wrapper", () => {
      const result = parsePipe("preview | withTabs");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("preview");
      expect(result[1].name).toBe("withTabs");
    });

    it("should parse mode with multiple wrappers", () => {
      const result = parsePipe("preview | withTabs | withSourceCode | withContainer");

      expect(result).toHaveLength(4);
      expect(result[0].name).toBe("preview");
      expect(result[1].name).toBe("withTabs");
      expect(result[2].name).toBe("withSourceCode");
      expect(result[3].name).toBe("withContainer");
    });

    it("should handle whitespace variations", () => {
      const result = parsePipe("preview|withTabs | withSourceCode  |  withContainer");

      expect(result).toHaveLength(4);
      expect(result[0].name).toBe("preview");
      expect(result[1].name).toBe("withTabs");
      expect(result[2].name).toBe("withSourceCode");
      expect(result[3].name).toBe("withContainer");
    });

    it("should parse query string config", () => {
      const result = parsePipe("preview | withTabs?default=code");

      expect(result).toHaveLength(2);
      expect(result[1].name).toBe("withTabs");
      expect(result[1].config).toEqual({ default: "code" });
    });

    it("should parse multiple query params", () => {
      const result = parsePipe("preview | withTabs?default=code&showResult=true");

      expect(result).toHaveLength(2);
      expect(result[1].config).toEqual({ default: "code", showResult: true });
    });

    it("should parse boolean shortcut in query string", () => {
      const result = parsePipe("preview | withCollapse?open");

      expect(result).toHaveLength(2);
      expect(result[1].config).toEqual({ open: true });
    });

    it("should parse numeric values in query string", () => {
      const result = parsePipe("preview | withContainer?padding=10");

      expect(result).toHaveLength(2);
      expect(result[1].config).toEqual({ padding: 10 });
    });

    it("should parse JSON config", () => {
      const result = parsePipe('preview | withContainer:{"class":"highlight","style":{"padding":10}}');

      expect(result).toHaveLength(2);
      expect(result[1].name).toBe("withContainer");
      expect(result[1].config).toEqual({
        class: "highlight",
        style: { padding: 10 },
      });
    });

    it("should handle invalid JSON gracefully", () => {
      const result = parsePipe("preview | withContainer:{invalid}");

      expect(result).toHaveLength(2);
      // Falls back to treating as simple name
      expect(result[1].name).toBe("withContainer:{invalid}");
    });

    it("should return empty array for empty string", () => {
      expect(parsePipe("")).toEqual([]);
    });

    it("should return empty array for null/undefined", () => {
      expect(parsePipe(null as unknown as string)).toEqual([]);
      expect(parsePipe(undefined as unknown as string)).toEqual([]);
    });
  });

  describe("org imports", () => {
    it("should parse org file import", () => {
      const result = parsePipe("./utils.org?name=myWrapper");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("./utils.org");
      expect(result[0].isOrgImport).toBe(true);
      expect(result[0].blockName).toBe("myWrapper");
    });

    it("should parse org import with additional config", () => {
      const result = parsePipe("./utils.org?name=myWrapper&theme=dark");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("./utils.org");
      expect(result[0].isOrgImport).toBe(true);
      expect(result[0].blockName).toBe("myWrapper");
      expect(result[0].config).toEqual({ theme: "dark" });
    });

    it("should parse org import without query string", () => {
      const result = parsePipe("./utils.org");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("./utils.org");
      expect(result[0].isOrgImport).toBe(true);
      expect(result[0].blockName).toBeUndefined();
    });

    it("should parse org import in pipeline", () => {
      const result = parsePipe("preview | ./wrappers.org?name=customWrapper | withTabs");

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("preview");
      expect(result[1].name).toBe("./wrappers.org");
      expect(result[1].isOrgImport).toBe(true);
      expect(result[1].blockName).toBe("customWrapper");
      expect(result[2].name).toBe("withTabs");
    });

    it("should handle relative paths with parent directories", () => {
      const result = parsePipe("../shared/utils.org?name=helper");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("../shared/utils.org");
      expect(result[0].isOrgImport).toBe(true);
      expect(result[0].blockName).toBe("helper");
    });
  });

  describe("value parsing", () => {
    it("should parse boolean true", () => {
      const result = parsePipe("preview | wrapper?enabled=true");
      expect(result[1].config?.enabled).toBe(true);
    });

    it("should parse boolean false", () => {
      const result = parsePipe("preview | wrapper?enabled=false");
      expect(result[1].config?.enabled).toBe(false);
    });

    it("should parse integer", () => {
      const result = parsePipe("preview | wrapper?count=42");
      expect(result[1].config?.count).toBe(42);
    });

    it("should parse float", () => {
      const result = parsePipe("preview | wrapper?ratio=3.14");
      expect(result[1].config?.ratio).toBe(3.14);
    });

    it("should parse null", () => {
      const result = parsePipe("preview | wrapper?value=null");
      expect(result[1].config?.value).toBeNull();
    });

    it("should parse quoted strings", () => {
      const result = parsePipe('preview | wrapper?message="hello world"');
      expect(result[1].config?.message).toBe("hello world");
    });

    it("should parse single-quoted strings", () => {
      const result = parsePipe("preview | wrapper?message='hello world'");
      expect(result[1].config?.message).toBe("hello world");
    });

    it("should keep unquoted strings as strings", () => {
      const result = parsePipe("preview | wrapper?name=foobar");
      expect(result[1].config?.name).toBe("foobar");
    });
  });

  describe("hasPipe", () => {
    it("should return true for pipe syntax", () => {
      expect(hasPipe("preview | withTabs")).toBe(true);
    });

    it("should return false for simple value", () => {
      expect(hasPipe("preview")).toBe(false);
    });

    it("should return false for query string without pipe", () => {
      expect(hasPipe("preview?config=value")).toBe(false);
    });
  });

  describe("getMode", () => {
    it("should return first segment name", () => {
      expect(getMode("preview | withTabs")).toBe("preview");
    });

    it("should return simple value as mode", () => {
      expect(getMode("server")).toBe("server");
    });

    it("should default to preview for empty", () => {
      expect(getMode("")).toBe("preview");
    });
  });

  describe("getWrappers", () => {
    it("should return wrappers after mode", () => {
      const wrappers = getWrappers("preview | withTabs | withSourceCode");

      expect(wrappers).toHaveLength(2);
      expect(wrappers[0].name).toBe("withTabs");
      expect(wrappers[1].name).toBe("withSourceCode");
    });

    it("should return empty array for mode-only", () => {
      expect(getWrappers("preview")).toEqual([]);
    });
  });

  describe("serializeSegment", () => {
    it("should serialize simple segment", () => {
      const segment: PipeSegment = { name: "preview" };
      expect(serializeSegment(segment)).toBe("preview");
    });

    it("should serialize segment with simple config", () => {
      const segment: PipeSegment = {
        name: "withTabs",
        config: { default: "code", enabled: true },
      };
      expect(serializeSegment(segment)).toBe("withTabs?default=code&enabled");
    });

    it("should serialize segment with complex config as JSON", () => {
      const segment: PipeSegment = {
        name: "withContainer",
        config: { style: { padding: 10 } },
      };
      expect(serializeSegment(segment)).toBe('withContainer:{"style":{"padding":10}}');
    });

    it("should serialize org import with block name", () => {
      const segment: PipeSegment = {
        name: "./utils.org",
        isOrgImport: true,
        blockName: "myWrapper",
      };
      expect(serializeSegment(segment)).toBe("./utils.org?name=myWrapper");
    });

    it("should serialize org import with block name and config", () => {
      const segment: PipeSegment = {
        name: "./utils.org",
        isOrgImport: true,
        blockName: "myWrapper",
        config: { theme: "dark" },
      };
      expect(serializeSegment(segment)).toBe("./utils.org?name=myWrapper&theme=dark");
    });
  });
});

describe("resolveUse", () => {
  it("should return explicit useParam when provided", () => {
    const result = resolveUse({
      useParam: "server | json",
      language: "javascript",
    });
    expect(result).toBe("server | json");
  });

  it("should use language default when no useParam", () => {
    const result = resolveUse({
      language: "css",
      languageDefaults: { css: "sourceOnly" },
    });
    expect(result).toBe("sourceOnly");
  });

  it("should use defaultUse when no useParam and no language default", () => {
    const result = resolveUse({
      language: "typescript",
      defaultUse: "preview | withSourceCode",
    });
    expect(result).toBe("preview | withSourceCode");
  });

  it("should fall back to 'preview' when no config provided", () => {
    const result = resolveUse({
      language: "typescript",
    });
    expect(result).toBe("preview");
  });

  it("should prioritize useParam over language default", () => {
    const result = resolveUse({
      useParam: "raw",
      language: "css",
      languageDefaults: { css: "sourceOnly" },
    });
    expect(result).toBe("raw");
  });

  it("should prioritize language default over global default", () => {
    const result = resolveUse({
      language: "shell",
      defaultUse: "preview",
      languageDefaults: { shell: "silent" },
    });
    expect(result).toBe("silent");
  });

  it("should handle empty useParam", () => {
    const result = resolveUse({
      useParam: "",
      language: "javascript",
      defaultUse: "preview",
    });
    expect(result).toBe("preview");
  });

  it("should handle missing language in languageDefaults", () => {
    const result = resolveUse({
      language: "python",
      defaultUse: "preview",
      languageDefaults: { javascript: "raw" },
    });
    expect(result).toBe("preview");
  });
});
