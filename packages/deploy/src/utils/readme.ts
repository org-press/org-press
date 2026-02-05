/**
 * README.md generation from org content
 *
 * Converts org AST to markdown for package README.
 */

import type { OrgData } from "uniorg";
import type { PackageMetadata } from "../types.ts";

/**
 * Generate README.md from org content
 *
 * Creates a README with:
 * - Package title and description
 * - Installation instructions
 * - Content extracted from org file (prose and code blocks)
 * - License
 *
 * @param ast - Parsed org AST
 * @param metadata - Package metadata
 * @returns README markdown content
 */
export function generateReadme(ast: OrgData, metadata: PackageMetadata): string {
  const parts: string[] = [];

  // Title
  parts.push(`# ${metadata.name}\n`);

  // Description
  if (metadata.description) {
    parts.push(`${metadata.description}\n`);
  }

  // Installation
  parts.push("## Installation\n");
  parts.push("```bash");
  parts.push(`npm install ${metadata.name}`);
  parts.push("```\n");

  // Extract prose content from org file
  const prose = extractProse(ast);
  if (prose) {
    parts.push("## Overview\n");
    parts.push(prose);
    parts.push("");
  }

  // License
  if (metadata.license) {
    parts.push("## License\n");
    parts.push(`${metadata.license}`);
  }

  return parts.join("\n");
}

/**
 * Extract prose content from org AST (excluding code blocks)
 *
 * Converts org elements to markdown:
 * - Headlines -> ## Headings
 * - Paragraphs -> Plain text
 * - Lists -> Markdown lists
 * - Code blocks -> Fenced code blocks
 *
 * @param ast - Parsed org AST
 * @returns Markdown prose content
 */
export function extractProse(ast: OrgData): string {
  const lines: string[] = [];

  function walk(node: any, depth = 0): void {
    if (!node) return;

    switch (node.type) {
      case "headline": {
        // In uniorg AST, headline children are the inline title elements (text, bold, etc.)
        // The rawValue property contains the plain text of the title
        const level = node.level || 1;
        const title = node.rawValue || extractText(node);
        if (title) {
          lines.push(`${"#".repeat(level + 1)} ${title}\n`);
        }
        break;
      }

      case "paragraph": {
        const text = extractText(node);
        if (text) {
          lines.push(`${text}\n`);
        }
        break;
      }

      case "plain-list": {
        for (const item of node.children || []) {
          const text = extractText(item);
          if (text) {
            lines.push(`- ${text}`);
          }
        }
        lines.push("");
        break;
      }

      case "src-block": {
        // Include all code blocks in README (named blocks are for export)
        const lang = node.language || "";
        lines.push(`\`\`\`${lang}`);
        lines.push(node.value || "");
        lines.push("```\n");
        break;
      }
    }

    if (node.children && node.type !== "src-block") {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(ast);
  return lines.join("\n").trim();
}

/**
 * Extract plain text from a node
 */
function extractText(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    return node.value || "";
  }

  if (node.children) {
    return node.children.map(extractText).join("");
  }

  return "";
}
