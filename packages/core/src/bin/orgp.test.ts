import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * CLI Integration Tests
 *
 * These tests verify that the orgp CLI binary works correctly by spawning
 * child processes and checking their output.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, "orgp.ts");
const NODE_ARGS = ["--experimental-strip-types", CLI_PATH];

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Execute the CLI with given arguments
 */
function runCLI(args: string[], timeout = 10000): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...NODE_ARGS, ...args], {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, exitCode: null });
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

describe("orgp CLI", () => {
  describe("help command", () => {
    it("should show help with --help flag", async () => {
      const result = await runCLI(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("orgp");
      expect(result.stdout).toContain("COMMANDS:");
      expect(result.stdout).toContain("dev");
      expect(result.stdout).toContain("build");
    });

    it("should show help with -h flag", async () => {
      const result = await runCLI(["-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("orgp");
    });

    it("should show help with help command", async () => {
      const result = await runCLI(["help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("orgp");
    });

    it("should not show PLUGIN COMMANDS when no CLI plugins configured", async () => {
      const result = await runCLI(["help"]);

      expect(result.exitCode).toBe(0);
      // Without user-configured CLI plugins, no PLUGIN COMMANDS section
      expect(result.stdout).not.toContain("PLUGIN COMMANDS:");
    });
  });

  describe("command recognition", () => {
    it("should recognize dev command", async () => {
      // dev without a valid project will fail, but should recognize the command
      const result = await runCLI(["dev", "--help"]);

      // The dev command should be recognized (may fail for other reasons)
      // We check that it doesn't report "Unknown command"
      expect(result.stdout + result.stderr).not.toContain("Unknown command");
    });

    it("should recognize build command", async () => {
      // build without a valid project will fail, but should recognize the command
      const result = await runCLI(["build", "--help"]);

      // The build command should be recognized
      expect(result.stdout + result.stderr).not.toContain("Unknown command");
    });
  });

  describe("no arguments", () => {
    it("should show help when no arguments provided", async () => {
      const result = await runCLI([]);

      // Should show help and exit with non-zero (no command specified)
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("orgp");
      expect(result.stdout).toContain("COMMANDS:");
    });
  });

  describe("error handling", () => {
    it("should report error for non-existent org file", async () => {
      const result = await runCLI(["run", "non-existent-file.org"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toContain("not found");
    });

    it("should report error for unknown flags in run mode", async () => {
      const result = await runCLI(["--unknown-flag"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toContain("unknown");
    });
  });
});
