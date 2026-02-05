/**
 * MCP Tools for org-press
 *
 * Exposes org-press CLI commands as MCP tools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";

interface ToolContext {
  projectRoot: string;
  contentDir: string;
}

/**
 * Run an orgp command and return the result
 */
async function runOrgpCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["orgp", command, ...args], {
      cwd,
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on("error", (err) => {
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Tool definitions for org-press
 */
export const orgPressTools = {
  test: {
    name: "org_test",
    description: "Run tests in org-mode code blocks using Vitest",
    inputSchema: {
      files: z.array(z.string()).optional().describe("Specific files to test"),
      name: z.string().optional().describe("Filter tests by block name"),
      watch: z.boolean().optional().describe("Run in watch mode"),
    },
  },
  fmt: {
    name: "org_fmt",
    description: "Format code blocks in org files using Prettier",
    inputSchema: {
      check: z.boolean().optional().describe("Check only, don't write changes"),
      files: z.array(z.string()).optional().describe("Specific files to format"),
      languages: z.array(z.string()).optional().describe("Filter by languages"),
    },
  },
  lint: {
    name: "org_lint",
    description: "Lint JavaScript/TypeScript code blocks using ESLint",
    inputSchema: {
      fix: z.boolean().optional().describe("Auto-fix problems"),
      files: z.array(z.string()).optional().describe("Specific files to lint"),
      languages: z.array(z.string()).optional().describe("Filter by languages"),
    },
  },
  typeCheck: {
    name: "org_type_check",
    description: "Type-check TypeScript code blocks",
    inputSchema: {
      files: z.array(z.string()).optional().describe("Specific files to check"),
    },
  },
  build: {
    name: "org_build",
    description: "Build the org-press site",
    inputSchema: {},
  },
};

/**
 * Register org-press tools with an MCP server
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  // Test tool
  server.tool(
    orgPressTools.test.name,
    orgPressTools.test.description,
    orgPressTools.test.inputSchema,
    async (args) => {
      const cmdArgs: string[] = [];
      if (args.files?.length) cmdArgs.push(...args.files);
      if (args.name) cmdArgs.push("--name", args.name);
      if (args.watch) cmdArgs.push("--watch");

      const result = await runOrgpCommand("test", cmdArgs, ctx.projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: result.stdout || result.stderr || "No output",
          },
        ],
        isError: result.exitCode !== 0,
      };
    }
  );

  // Format tool
  server.tool(
    orgPressTools.fmt.name,
    orgPressTools.fmt.description,
    orgPressTools.fmt.inputSchema,
    async (args) => {
      const cmdArgs: string[] = [];
      if (args.check) cmdArgs.push("--check");
      if (args.files?.length) cmdArgs.push(...args.files);
      if (args.languages?.length) cmdArgs.push("--languages", args.languages.join(","));

      const result = await runOrgpCommand("fmt", cmdArgs, ctx.projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: result.stdout || result.stderr || "No output",
          },
        ],
        isError: result.exitCode !== 0,
      };
    }
  );

  // Lint tool
  server.tool(
    orgPressTools.lint.name,
    orgPressTools.lint.description,
    orgPressTools.lint.inputSchema,
    async (args) => {
      const cmdArgs: string[] = [];
      if (args.fix) cmdArgs.push("--fix");
      if (args.files?.length) cmdArgs.push(...args.files);
      if (args.languages?.length) cmdArgs.push("--languages", args.languages.join(","));

      const result = await runOrgpCommand("lint", cmdArgs, ctx.projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: result.stdout || result.stderr || "No output",
          },
        ],
        isError: result.exitCode !== 0,
      };
    }
  );

  // Type-check tool
  server.tool(
    orgPressTools.typeCheck.name,
    orgPressTools.typeCheck.description,
    orgPressTools.typeCheck.inputSchema,
    async (args) => {
      const cmdArgs: string[] = [];
      if (args.files?.length) cmdArgs.push(...args.files);

      const result = await runOrgpCommand("type-check", cmdArgs, ctx.projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: result.stdout || result.stderr || "No output",
          },
        ],
        isError: result.exitCode !== 0,
      };
    }
  );

  // Build tool
  server.tool(
    orgPressTools.build.name,
    orgPressTools.build.description,
    orgPressTools.build.inputSchema,
    async () => {
      const result = await runOrgpCommand("build", [], ctx.projectRoot);

      return {
        content: [
          {
            type: "text" as const,
            text: result.stdout || result.stderr || "No output",
          },
        ],
        isError: result.exitCode !== 0,
      };
    }
  );
}
