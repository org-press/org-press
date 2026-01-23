/**
 * MCP Resources for org-press
 *
 * Exposes org-press data as MCP resources.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface ResourceContext {
  projectRoot: string;
  contentDir: string;
}

/**
 * Find all org files recursively
 */
function findOrgFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
        files.push(...findOrgFiles(fullPath));
      }
    } else if (entry.name.endsWith(".org")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract blocks from an org file
 */
function extractBlocks(
  filePath: string,
  projectRoot: string
): Array<{
  name?: string;
  index: number;
  language: string;
  code: string;
  line: number;
}> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const blocks: Array<{
    name?: string;
    index: number;
    language: string;
    code: string;
    line: number;
  }> = [];

  let blockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const beginMatch = line.match(/^\s*#\+begin_src\s+(\w+)/i);

    if (beginMatch) {
      const language = beginMatch[1].toLowerCase();

      // Look backwards for #+NAME:
      let name: string | undefined;
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        const nameMatch = prevLine.match(/^#\+name:\s*(.+)$/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
          break;
        }
        if (prevLine && !prevLine.startsWith("#")) break;
      }

      // Find end and extract code
      let endLine = i;
      for (let k = i + 1; k < lines.length; k++) {
        if (lines[k].match(/^\s*#\+end_src\s*$/i)) {
          endLine = k;
          break;
        }
      }

      const code = lines.slice(i + 1, endLine).join("\n");

      blocks.push({
        name,
        index: blockIndex,
        language,
        code,
        line: i + 1,
      });

      blockIndex++;
    }
  }

  return blocks;
}

/**
 * Resource definitions for org-press
 */
export const orgPressResources = {
  blocks: {
    uri: "org-press://blocks",
    name: "Code Blocks",
    description: "List all code blocks in the project",
    mimeType: "application/json",
  },
  config: {
    uri: "org-press://config",
    name: "Project Configuration",
    description: "Org-press project configuration",
    mimeType: "application/json",
  },
};

/**
 * Register org-press resources with an MCP server
 */
export function registerResources(server: McpServer, ctx: ResourceContext): void {
  const absoluteContentDir = path.isAbsolute(ctx.contentDir)
    ? ctx.contentDir
    : path.join(ctx.projectRoot, ctx.contentDir);

  // List all blocks resource
  server.resource(
    orgPressResources.blocks.uri,
    orgPressResources.blocks.name,
    async () => {
      const orgFiles = findOrgFiles(absoluteContentDir);
      const allBlocks: Array<{
        file: string;
        name?: string;
        index: number;
        language: string;
        line: number;
        preview: string;
      }> = [];

      for (const file of orgFiles) {
        const relativePath = path.relative(ctx.projectRoot, file);
        const blocks = extractBlocks(file, ctx.projectRoot);

        for (const block of blocks) {
          allBlocks.push({
            file: relativePath,
            name: block.name,
            index: block.index,
            language: block.language,
            line: block.line,
            preview: block.code.slice(0, 100) + (block.code.length > 100 ? "..." : ""),
          });
        }
      }

      return {
        contents: [
          {
            uri: orgPressResources.blocks.uri,
            mimeType: orgPressResources.blocks.mimeType,
            text: JSON.stringify(allBlocks, null, 2),
          },
        ],
      };
    }
  );

  // Project configuration resource
  server.resource(
    orgPressResources.config.uri,
    orgPressResources.config.name,
    async () => {
      // Try to load config from .org-press/config.ts or similar
      const configPaths = [
        ".org-press/config.ts",
        ".org-press/config.js",
        "org-press.config.ts",
        "org-press.config.js",
      ];

      let configContent = "{}";
      let configPath = "not found";

      for (const cp of configPaths) {
        const fullPath = path.join(ctx.projectRoot, cp);
        if (fs.existsSync(fullPath)) {
          configContent = fs.readFileSync(fullPath, "utf-8");
          configPath = cp;
          break;
        }
      }

      // Get project info
      const packageJsonPath = path.join(ctx.projectRoot, "package.json");
      let packageInfo = {};
      if (fs.existsSync(packageJsonPath)) {
        try {
          packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        } catch {}
      }

      const projectInfo = {
        projectRoot: ctx.projectRoot,
        contentDir: ctx.contentDir,
        configFile: configPath,
        configContent,
        package: {
          name: (packageInfo as any).name,
          version: (packageInfo as any).version,
        },
      };

      return {
        contents: [
          {
            uri: orgPressResources.config.uri,
            mimeType: orgPressResources.config.mimeType,
            text: JSON.stringify(projectInfo, null, 2),
          },
        ],
      };
    }
  );

  // Dynamic block content resource template
  server.resource(
    "org-press://block/{file}/{identifier}",
    "Block Content",
    async (uri) => {
      // Parse the URI to get file and identifier
      const match = uri.href.match(/org-press:\/\/block\/(.+)\/(.+)/);
      if (!match) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "Invalid block URI",
            },
          ],
        };
      }

      const [, filePath, identifier] = match;
      const fullPath = path.join(ctx.projectRoot, decodeURIComponent(filePath));

      if (!fs.existsSync(fullPath)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `File not found: ${filePath}`,
            },
          ],
        };
      }

      const blocks = extractBlocks(fullPath, ctx.projectRoot);

      // Find block by name or index
      let block;
      if (/^\d+$/.test(identifier)) {
        block = blocks.find((b) => b.index === parseInt(identifier, 10));
      } else {
        block = blocks.find((b) => b.name === identifier);
      }

      if (!block) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Block not found: ${identifier} in ${filePath}`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: block.code,
          },
        ],
      };
    }
  );
}
