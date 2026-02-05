import { describe, it, expect } from "vitest";
import { isHashbangInvocation, parseHashbangArgs } from "./hashbang.ts";

describe("Hashbang Handler", () => {
  describe("isHashbangInvocation", () => {
    it("should return true for org file as first argument", () => {
      expect(isHashbangInvocation(["./script.org"])).toBe(true);
      expect(isHashbangInvocation(["file.org"])).toBe(true);
      expect(isHashbangInvocation(["/path/to/file.org"])).toBe(true);
      expect(isHashbangInvocation(["../relative/path.org"])).toBe(true);
    });

    it("should return true for org file with additional arguments", () => {
      expect(isHashbangInvocation(["./script.org", "run", "build"])).toBe(true);
      expect(isHashbangInvocation(["./script.org", "serve", "--port", "3000"])).toBe(true);
      expect(isHashbangInvocation(["./script.org", "arg1", "arg2"])).toBe(true);
    });

    it("should return false for non-org first argument", () => {
      expect(isHashbangInvocation(["build", "./site"])).toBe(false);
      expect(isHashbangInvocation(["serve"])).toBe(false);
      expect(isHashbangInvocation(["--help"])).toBe(false);
      expect(isHashbangInvocation(["script.js"])).toBe(false);
    });

    it("should return false for empty arguments", () => {
      expect(isHashbangInvocation([])).toBe(false);
    });
  });

  describe("parseHashbangArgs", () => {
    describe("default invocation", () => {
      it("should parse org file alone as default subcommand", () => {
        const result = parseHashbangArgs(["./file.org"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "default",
          args: [],
        });
      });

      it("should pass unknown arguments to default subcommand", () => {
        const result = parseHashbangArgs(["./file.org", "arg1", "arg2"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "default",
          args: ["arg1", "arg2"],
        });
      });

      it("should treat word-like arguments as potential plugin subcommands", () => {
        // Words with only letters are treated as potential plugin commands
        const result = parseHashbangArgs(["./file.org", "unknown", "command"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "unknown",
          args: ["command"],
        });
      });
    });

    describe("run subcommand", () => {
      it("should parse run with block name", () => {
        const result = parseHashbangArgs(["./file.org", "run", "build"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "run",
          blockName: "build",
          args: [],
        });
      });

      it("should parse run with block name and arguments after --", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "run",
          "build",
          "--",
          "-v",
          "--force",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "run",
          blockName: "build",
          args: ["-v", "--force"],
        });
      });

      it("should handle -- separator with multiple arguments", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "run",
          "deploy",
          "--",
          "--env",
          "production",
          "--verbose",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "run",
          blockName: "deploy",
          args: ["--env", "production", "--verbose"],
        });
      });

      it("should throw if run has no block name", () => {
        expect(() => parseHashbangArgs(["./file.org", "run"])).toThrow(
          "'run' subcommand requires a block name"
        );
      });
    });

    describe("serve subcommand", () => {
      it("should parse serve without arguments", () => {
        const result = parseHashbangArgs(["./file.org", "serve"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "serve",
          args: [],
        });
      });

      it("should parse serve with port option", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "serve",
          "--port",
          "3000",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "serve",
          args: ["--port", "3000"],
        });
      });

      it("should parse serve with multiple options", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "serve",
          "--port",
          "3000",
          "--host",
          "0.0.0.0",
          "--open",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "serve",
          args: ["--port", "3000", "--host", "0.0.0.0", "--open"],
        });
      });
    });

    describe("build subcommand", () => {
      it("should parse build without arguments", () => {
        const result = parseHashbangArgs(["./file.org", "build"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "build",
          args: [],
        });
      });

      it("should parse build with output directory", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "build",
          "--outDir",
          "dist",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "build",
          args: ["--outDir", "dist"],
        });
      });
    });

    describe("deploy subcommand", () => {
      it("should parse deploy without arguments", () => {
        const result = parseHashbangArgs(["./file.org", "deploy"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "deploy",
          args: [],
        });
      });

      it("should parse deploy with options", () => {
        const result = parseHashbangArgs([
          "./file.org",
          "deploy",
          "--target",
          "production",
        ]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "deploy",
          args: ["--target", "production"],
        });
      });
    });

    describe("help subcommand", () => {
      it("should parse --help flag", () => {
        const result = parseHashbangArgs(["./file.org", "--help"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "help",
          args: [],
        });
      });

      it("should parse -h flag", () => {
        const result = parseHashbangArgs(["./file.org", "-h"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "help",
          args: [],
        });
      });

      it("should parse help command", () => {
        const result = parseHashbangArgs(["./file.org", "help"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "help",
          args: [],
        });
      });
    });

    describe("error handling", () => {
      it("should throw for empty arguments", () => {
        expect(() => parseHashbangArgs([])).toThrow("No arguments provided");
      });

      it("should throw for non-org first argument", () => {
        expect(() => parseHashbangArgs(["script.js"])).toThrow(
          "First argument must be an org file"
        );
      });

      it("should throw for command as first argument", () => {
        expect(() => parseHashbangArgs(["build"])).toThrow(
          "First argument must be an org file"
        );
      });
    });

    describe("edge cases", () => {
      it("should handle org file with spaces in path", () => {
        const result = parseHashbangArgs(["./path with spaces/file.org"]);
        expect(result).toEqual({
          file: "./path with spaces/file.org",
          subcommand: "default",
          args: [],
        });
      });

      it("should handle absolute paths", () => {
        const result = parseHashbangArgs(["/home/user/scripts/task.org", "run", "main"]);
        expect(result).toEqual({
          file: "/home/user/scripts/task.org",
          subcommand: "run",
          blockName: "main",
          args: [],
        });
      });

      it("should handle .org extension case sensitivity", () => {
        // Currently only .org (lowercase) is supported
        expect(isHashbangInvocation(["file.org"])).toBe(true);
        expect(isHashbangInvocation(["file.ORG"])).toBe(false);
      });

      it("should not treat -- as first arg after run block name as separator", () => {
        // run blockname -- should result in empty args
        const result = parseHashbangArgs(["./file.org", "run", "test", "--"]);
        expect(result).toEqual({
          file: "./file.org",
          subcommand: "run",
          blockName: "test",
          args: [],
        });
      });
    });
  });
});
