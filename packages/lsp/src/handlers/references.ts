/**
 * LSP References Handler
 *
 * Provides find-references for symbols in code blocks.
 */

import type {
  Location,
  Position,
  Range,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { TypeScriptService } from "../typescript-service.js";

/**
 * Handle find-references requests
 */
export function handleReferences(
  service: TypeScriptService,
  document: TextDocument,
  position: Position,
  projectRoot: string
): Location[] {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const references = service.getReferences(orgFilePath, position);
  if (!references || references.length === 0) return [];

  return references.map((ref) => {
    const refUri = `file://${projectRoot}/${ref.orgFilePath}`;

    return {
      uri: refUri,
      range: {
        start: ref.position,
        end: ref.position,
      } as Range,
    };
  });
}

/**
 * Handle go-to-type-definition requests
 */
export function handleTypeDefinition(
  service: TypeScriptService,
  document: TextDocument,
  position: Position,
  projectRoot: string
): Location[] {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const definitions = service.getTypeDefinitions(orgFilePath, position);
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

/**
 * Handle go-to-implementation requests
 */
export function handleImplementation(
  service: TypeScriptService,
  document: TextDocument,
  position: Position,
  projectRoot: string
): Location[] {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const implementations = service.getImplementations(orgFilePath, position);
  if (!implementations || implementations.length === 0) return [];

  return implementations.map((impl) => {
    const implUri = `file://${projectRoot}/${impl.orgFilePath}`;

    return {
      uri: implUri,
      range: {
        start: impl.position,
        end: impl.position,
      } as Range,
    };
  });
}
