/**
 * Deploy Plugin tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import { parseDeployArgs, runDeploy, deployPlugin } from "./plugin.ts";
import { clearAdapters, initBuiltinAdapters } from "./adapters/index.ts";
import type { ParsedArgs, CommandContext } from "org-press";

// Mock fs module
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal() as typeof fs;
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

describe("parseDeployArgs", () => {
  it("should extract org file from positional args", () => {
    const args: ParsedArgs = {
      _: ["my-package.org"],
    };

    const result = parseDeployArgs(args);

    expect(result.orgFile).toBe("my-package.org");
  });

  it("should return undefined orgFile when not provided", () => {
    const args: ParsedArgs = {
      _: [],
    };

    const result = parseDeployArgs(args);

    expect(result.orgFile).toBeUndefined();
  });

  it("should parse adapter option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      adapter: "github-pages",
    };

    const result = parseDeployArgs(args);

    expect(result.options.adapter).toBe("github-pages");
  });

  it("should parse registry option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      registry: "https://custom.registry.com",
    };

    const result = parseDeployArgs(args);

    expect(result.options.registry).toBe("https://custom.registry.com");
  });

  it("should parse tag option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      tag: "beta",
    };

    const result = parseDeployArgs(args);

    expect(result.options.tag).toBe("beta");
  });

  it("should parse dry-run option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      "dry-run": true,
    };

    const result = parseDeployArgs(args);

    expect(result.options.dryRun).toBe(true);
  });

  it("should parse access option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      access: "public",
    };

    const result = parseDeployArgs(args);

    expect(result.options.access).toBe("public");
  });

  it("should parse out-dir option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      "out-dir": "/custom/output",
    };

    const result = parseDeployArgs(args);

    expect(result.options.outDir).toBe("/custom/output");
  });

  it("should parse no-readme option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      "no-readme": true,
    };

    const result = parseDeployArgs(args);

    expect(result.options.noReadme).toBe(true);
  });

  it("should parse skip-build option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      "skip-build": true,
    };

    const result = parseDeployArgs(args);

    expect(result.options.skipBuild).toBe(true);
  });

  it("should parse bump option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      bump: "patch",
    };

    const result = parseDeployArgs(args);

    expect(result.options.bump).toBe("patch");
  });

  it("should parse environment option", () => {
    const args: ParsedArgs = {
      _: ["file.org"],
      environment: "preview",
    };

    const result = parseDeployArgs(args);

    expect(result.options.environment).toBe("preview");
  });

  it("should parse all options together", () => {
    const args: ParsedArgs = {
      _: ["my-package.org", "extra-arg"],
      adapter: "npm",
      registry: "https://npm.example.com",
      tag: "next",
      "dry-run": true,
      access: "restricted",
      "out-dir": "/build",
      "no-readme": true,
      "skip-build": false,
      bump: "minor",
      environment: "development",
    };

    const result = parseDeployArgs(args);

    expect(result.orgFile).toBe("my-package.org");
    expect(result.options).toEqual({
      adapter: "npm",
      registry: "https://npm.example.com",
      tag: "next",
      dryRun: true,
      access: "restricted",
      outDir: "/build",
      noReadme: true,
      skipBuild: false,
      bump: "minor",
      environment: "development",
    });
  });
});

describe("runDeploy", () => {
  const mockContext: CommandContext = {
    config: {
      contentDir: "content",
      cacheDir: ".cache",
      outDir: "dist",
      base: "/",
    },
    projectRoot: "/project",
    contentDir: "/project/content",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAdapters();
    initBuiltinAdapters();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return error when no org file specified", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const args: ParsedArgs = { _: [] };
    const result = await runDeploy(args, mockContext);

    expect(result).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No org file specified")
    );

    consoleSpy.mockRestore();
  });

  it("should return error when org file not found", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = { _: ["nonexistent.org"] };
    const result = await runDeploy(args, mockContext);

    expect(result).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Deployment failed")
    );

    consoleSpy.mockRestore();
  });

  it("should succeed with dry run", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
#+TITLE: test-package
#+VERSION: 1.0.0

#+NAME: main
#+BEGIN_SRC javascript
export const x = 1;
#+END_SRC
`);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.rmSync).mockImplementation(() => {});

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      _: ["test.org"],
      "dry-run": true,
    };
    const result = await runDeploy(args, mockContext);

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Deployment successful")
    );

    consoleSpy.mockRestore();
  });

  it("should pass options to deploy function", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
#+TITLE: test-package
#+VERSION: 1.0.0

#+NAME: main
#+BEGIN_SRC javascript
export const x = 1;
#+END_SRC
`);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.rmSync).mockImplementation(() => {});

    vi.spyOn(console, "log").mockImplementation(() => {});

    const args: ParsedArgs = {
      _: ["test.org"],
      "dry-run": true,
      tag: "beta",
      bump: "patch",
    };
    const result = await runDeploy(args, mockContext);

    expect(result).toBe(0);
  });
});

describe("deployPlugin", () => {
  it("should have correct command name", () => {
    expect(deployPlugin.name).toBe("command:deploy");
  });

  it("should have correct plugin type", () => {
    expect(deployPlugin._type).toBe("command");
  });

  it("should have description", () => {
    const config = deployPlugin._config as { description: string };
    expect(config.description).toContain("Deploy org file");
  });

  it("should have argument definitions", () => {
    const config = deployPlugin._config as { args: unknown[] };
    expect(config.args).toBeDefined();
    expect(Array.isArray(config.args)).toBe(true);
    expect(config.args.length).toBeGreaterThan(0);
  });

  it("should have adapter argument", () => {
    const config = deployPlugin._config as { args: Array<{ name: string }> };
    const adapterArg = config.args.find((a) => a.name === "adapter");
    expect(adapterArg).toBeDefined();
  });

  it("should have dry-run argument", () => {
    const config = deployPlugin._config as { args: Array<{ name: string }> };
    const dryRunArg = config.args.find((a) => a.name === "dry-run");
    expect(dryRunArg).toBeDefined();
  });

  it("should have bump argument", () => {
    const config = deployPlugin._config as { args: Array<{ name: string }> };
    const bumpArg = config.args.find((a) => a.name === "bump");
    expect(bumpArg).toBeDefined();
  });

  it("should have execute function", () => {
    const config = deployPlugin._config as { execute: unknown };
    expect(typeof config.execute).toBe("function");
  });

  it("should have setup function for plugin registration", () => {
    expect(typeof deployPlugin.setup).toBe("function");
  });
});
