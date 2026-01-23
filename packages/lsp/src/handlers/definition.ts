/**
 * LSP Definition Handler
 *
 * Provides go-to-definition for symbols in code blocks.
 */

import type {
  Location,
  Position,
  Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { TypeScriptService } from "../typescript-service.js";

/**
 * Handle go-to-definition requests
 */
export function handleDefinition(
  service: TypeScriptService,
  document: TextDocument,
  position: Position,
  projectRoot: string
): Location[] {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const definitions = service.getDefinitions(orgFilePath, position);
  if (!definitions || definitions.length === 0) return [];

  return definitions.map((def) => {
    const defUri = `file://${projectRoot}/${def.orgFilePath}`;

    return {
      uri: defUri,
      range: {
        start: def.position,
        end: def.position,
      } as Range,
    };
  });
}
