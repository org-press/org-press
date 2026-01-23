/**
 * LSP Hover Handler
 *
 * Provides hover information for symbols in code blocks.
 */

import type { Hover, Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import ts from "typescript";
import type { TypeScriptService } from "../typescript-service.js";

/**
 * Handle hover requests
 */
export function handleHover(
  service: TypeScriptService,
  document: TextDocument,
  position: Position
): Hover | null {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const quickInfo = service.getQuickInfo(orgFilePath, position);
  if (!quickInfo) return null;

  // Build hover content
  const parts: string[] = [];

  // Type/signature info
  if (quickInfo.displayParts) {
    const signature = ts.displayPartsToString(quickInfo.displayParts);
    if (signature) {
      parts.push("```typescript\n" + signature + "\n```");
    }
  }

  // Documentation
  if (quickInfo.documentation) {
    const doc = ts.displayPartsToString(quickInfo.documentation);
    if (doc) {
      parts.push(doc);
    }
  }

  // Tags (like @param, @returns)
  if (quickInfo.tags) {
    for (const tag of quickInfo.tags) {
      const tagText = ts.displayPartsToString(tag.text || []);
      if (tag.name === "param") {
        parts.push(`*@param* ${tagText}`);
      } else if (tag.name === "returns" || tag.name === "return") {
        parts.push(`*@returns* ${tagText}`);
      } else if (tag.name === "example") {
        parts.push("**Example:**\n```typescript\n" + tagText + "\n```");
      } else if (tagText) {
        parts.push(`*@${tag.name}* ${tagText}`);
      }
    }
  }

  if (parts.length === 0) return null;

  return {
    contents: {
      kind: "markdown",
      value: parts.join("\n\n"),
    },
  };
}
