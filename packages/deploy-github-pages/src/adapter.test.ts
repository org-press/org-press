/**
 * GitHub Pages Adapter tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import { GitHubPagesAdapter, githubPagesAdapter } from "./adapter.ts";
import type {
  DeployContext,
  AdapterConfig,
  PackageMetadata,
  DeployLogger,
} from "@org-press/deploy";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  rmSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("GitHubPagesAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create adapter with default options", () => {
      const adapter = new GitHubPagesAdapter();
      expect(adapter.name).toBe("github-pages");
      expect(adapter.description).toBe("Deploy to GitHub Pages");
    });

    it("should accept custom config", () => {
      const adapter = new GitHubPagesAdapter({
        repo: "user/repo",
        branch: "main",
        cname: "example.com",
        noJekyll: false,
        message: "Custom deploy message",
      });
      expect(adapter.name).toBe("github-pages");
    });
  });

  describe("validate", () => {
    it("should validate successfully when git is available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "git version 2.40.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new GitHubPagesAdapter({ repo: "user/repo" });
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail if git is not available", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr: "git not found",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new GitHubPagesAdapter();
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("git is not available in PATH");
    });

    it("should fail with invalid repository format", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "git version 2.40.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new GitHubPagesAdapter();
      const config: AdapterConfig = {
        options: { repo: "invalid-repo-format" },
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Invalid repository format"))
      ).toBe(true);
    });

    it("should accept valid repository formats", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "git version 2.40.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const testCases = [
        "user/repo",
        "org/my-repo",
        "User123/Repo.Name",
        "org-name/repo_name",
      ];

      for (const repo of testCases) {
        const adapter = new GitHubPagesAdapter({ repo });
        const config: AdapterConfig = {
          options: {},
          env: {},
        };

        const result = await adapter.validate(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it("should fail with invalid branch name", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "git version 2.40.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new GitHubPagesAdapter();
      const config: AdapterConfig = {
        options: { repo: "user/repo", branch: "invalid branch!" },
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid branch name"))).toBe(
        true
      );
    });

    it("should warn when no repo specified", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "git version 2.40.0",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      const adapter = new GitHubPagesAdapter();
      const config: AdapterConfig = {
        options: {},
        env: {},
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("auto-detect"))).toBe(true);
    });
  });

  describe("deploy", () => {
    const createLogger = (): DeployLogger & { logs: string[] } => {
      const logs: string[] = [];
      return {
        logs,
        info: (msg) => logs.push(`INFO: ${msg}`),
        warn: (msg) => logs.push(`WARN: ${msg}`),
        error: (msg) => logs.push(`ERROR: ${msg}`),
        debug: (msg) => logs.push(`DEBUG: ${msg}`),
      };
    };

    const createContext = (
      overrides: Partial<DeployContext> = {}
    ): DeployContext => {
      const metadata: PackageMetadata = {
        name: "test-site",
        version: "1.0.0",
        description: "Test site",
      };

      return {
        outDir: "/tmp/test-deploy",
        metadata,
        adapterConfig: {},
        environment: "production",
        dryRun: false,
        logger: createLogger(),
        ...overrides,
      };
    };

    it("should return success for dry run without executing git commands", async () => {
      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext({ dryRun: true });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.deploymentId).toContain("dry-run-");
      expect(result.url).toBe("https://user.github.io/my-site");
      // Git commands should not be called in dry run (except for auto-detect if no repo)
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("should create .nojekyll file by default", async () => {
      // Mock all git commands to succeed
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext();

      await adapter.deploy(context);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/tmp/test-deploy/.nojekyll",
        ""
      );
    });

    it("should not create .nojekyll file when noJekyll is false", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/my-site",
        noJekyll: false,
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(fs.writeFileSync).not.toHaveBeenCalledWith(
        "/tmp/test-deploy/.nojekyll",
        ""
      );
    });

    it("should create CNAME file when cname is specified", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/my-site",
        cname: "example.com",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "/tmp/test-deploy/CNAME",
        "example.com"
      );
    });

    it("should return custom domain URL when cname is specified", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/my-site",
        cname: "example.com",
      });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com");
    });

    it("should remove existing .git directory", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext();

      await adapter.deploy(context);

      expect(fs.rmSync).toHaveBeenCalledWith("/tmp/test-deploy/.git", {
        recursive: true,
      });
    });

    it("should initialize git repository and push to gh-pages branch", async () => {
      const gitCalls: string[][] = [];
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args as string[]);
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);

      // Verify git commands were called
      expect(gitCalls).toContainEqual(["init"]);
      expect(gitCalls).toContainEqual(["add", "-A"]);
      expect(gitCalls).toContainEqual([
        "commit",
        "-m",
        "Deploy to GitHub Pages",
      ]);
      expect(
        gitCalls.some(
          (call) =>
            call[0] === "remote" &&
            call[1] === "add" &&
            call[3] === "https://github.com/user/my-site.git"
        )
      ).toBe(true);
      expect(gitCalls).toContainEqual([
        "push",
        "-f",
        "origin",
        "HEAD:gh-pages",
      ]);
    });

    it("should use custom branch name", async () => {
      const gitCalls: string[][] = [];
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args as string[]);
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/my-site",
        branch: "docs",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(gitCalls).toContainEqual(["push", "-f", "origin", "HEAD:docs"]);
    });

    it("should use custom commit message", async () => {
      const gitCalls: string[][] = [];
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args as string[]);
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/my-site",
        message: "Custom deploy",
      });
      const context = createContext();

      await adapter.deploy(context);

      expect(gitCalls).toContainEqual(["commit", "-m", "Custom deploy"]);
    });

    it("should use adapterConfig options over constructor config", async () => {
      const gitCalls: string[][] = [];
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args as string[]);
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "user/default-repo",
        branch: "default-branch",
        message: "Default message",
      });

      const context = createContext({
        adapterConfig: {
          repo: "user/custom-repo",
          branch: "custom-branch",
          message: "Custom message",
        },
      });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(gitCalls).toContainEqual(["commit", "-m", "Custom message"]);
      expect(gitCalls).toContainEqual([
        "push",
        "-f",
        "origin",
        "HEAD:custom-branch",
      ]);
      expect(
        gitCalls.some(
          (call) =>
            call[0] === "remote" &&
            call[1] === "add" &&
            call[3] === "https://github.com/user/custom-repo.git"
        )
      ).toBe(true);
    });

    it("should return failure when git init fails", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git" && (args as string[])[0] === "init") {
          return {
            status: 1,
            stdout: "",
            stderr: "fatal: not a git repository",
            pid: 123,
            output: [],
            signal: null,
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to initialize git repository");
    });

    it("should return failure when git push fails", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git" && (args as string[])[0] === "push") {
          return {
            status: 1,
            stdout: "",
            stderr: "Permission denied",
            pid: 123,
            output: [],
            signal: null,
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({ repo: "user/my-site" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to push to GitHub");
    });

    it("should return failure when repo auto-detection fails", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        if (cmd === "git" && (args as string[])[0] === "remote") {
          return {
            status: 1,
            stdout: "",
            stderr: "fatal: not a git repository",
            pid: 123,
            output: [],
            signal: null,
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      const adapter = new GitHubPagesAdapter(); // No repo specified
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not auto-detect repository");
    });

    it("should auto-detect repo from HTTPS remote URL", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        const argsList = args as string[];
        if (
          cmd === "git" &&
          argsList[0] === "remote" &&
          argsList[1] === "get-url"
        ) {
          return {
            status: 0,
            stdout: "https://github.com/user/my-repo.git\n",
            stderr: "",
            pid: 123,
            output: [],
            signal: null,
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter();
      const logger = createLogger();
      const context = createContext({ logger });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(logger.logs.some((l) => l.includes("Auto-detected"))).toBe(true);
      expect(logger.logs.some((l) => l.includes("user/my-repo"))).toBe(true);
    });

    it("should auto-detect repo from SSH remote URL", async () => {
      vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
        const argsList = args as string[];
        if (
          cmd === "git" &&
          argsList[0] === "remote" &&
          argsList[1] === "get-url"
        ) {
          return {
            status: 0,
            stdout: "git@github.com:user/my-repo.git\n",
            stderr: "",
            pid: 123,
            output: [],
            signal: null,
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
          pid: 123,
          output: [],
          signal: null,
        };
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter();
      const logger = createLogger();
      const context = createContext({ logger });

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(logger.logs.some((l) => l.includes("user/my-repo"))).toBe(true);
    });

    it("should return correct URL for user.github.io repos", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({
        repo: "username/username.github.io",
      });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://username.github.io");
    });

    it("should return correct URL for project repos", async () => {
      vi.mocked(childProcess.spawnSync).mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 123,
        output: [],
        signal: null,
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const adapter = new GitHubPagesAdapter({ repo: "org/my-project" });
      const context = createContext();

      const result = await adapter.deploy(context);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://org.github.io/my-project");
    });
  });
});

describe("githubPagesAdapter factory", () => {
  it("should create GitHubPagesAdapter instance", () => {
    const adapter = githubPagesAdapter({ repo: "user/repo" });
    expect(adapter).toBeInstanceOf(GitHubPagesAdapter);
    expect(adapter.name).toBe("github-pages");
  });

  it("should create adapter with default config when no options provided", () => {
    const adapter = githubPagesAdapter();
    expect(adapter).toBeInstanceOf(GitHubPagesAdapter);
    expect(adapter.name).toBe("github-pages");
  });
});
