/**
 * LSP Completion Handler
 *
 * Provides auto-completion for code blocks in org files.
 */

import type {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import ts from "typescript";
import type { TypeScriptService } from "../typescript-service.js";

/**
 * Map TypeScript completion kinds to LSP completion kinds
 */
function mapCompletionKind(
  tsKind: ts.ScriptElementKind
): CompletionItemKind {
  const kindMap: Partial<Record<ts.ScriptElementKind, CompletionItemKind>> = {
    [ts.ScriptElementKind.unknown]: 1, // Text
    [ts.ScriptElementKind.warning]: 1,
    [ts.ScriptElementKind.keyword]: 14, // Keyword
    [ts.ScriptElementKind.scriptElement]: 1,
    [ts.ScriptElementKind.moduleElement]: 9, // Module
    [ts.ScriptElementKind.classElement]: 7, // Class
    [ts.ScriptElementKind.localClassElement]: 7,
    [ts.ScriptElementKind.interfaceElement]: 8, // Interface
    [ts.ScriptElementKind.typeElement]: 8,
    [ts.ScriptElementKind.enumElement]: 13, // Enum
    [ts.ScriptElementKind.enumMemberElement]: 20, // EnumMember
    [ts.ScriptElementKind.variableElement]: 6, // Variable
    [ts.ScriptElementKind.localVariableElement]: 6,
    [ts.ScriptElementKind.functionElement]: 3, // Function
    [ts.ScriptElementKind.localFunctionElement]: 3,
    [ts.ScriptElementKind.memberFunctionElement]: 2, // Method
    [ts.ScriptElementKind.memberGetAccessorElement]: 10, // Property
    [ts.ScriptElementKind.memberSetAccessorElement]: 10,
    [ts.ScriptElementKind.memberVariableElement]: 5, // Field
    [ts.ScriptElementKind.constructorImplementationElement]: 4, // Constructor
    [ts.ScriptElementKind.callSignatureElement]: 3,
    [ts.ScriptElementKind.indexSignatureElement]: 3,
    [ts.ScriptElementKind.constructSignatureElement]: 4,
    [ts.ScriptElementKind.parameterElement]: 6,
    [ts.ScriptElementKind.typeParameterElement]: 25, // TypeParameter
    [ts.ScriptElementKind.primitiveType]: 25,
    [ts.ScriptElementKind.label]: 1,
    [ts.ScriptElementKind.alias]: 6,
    [ts.ScriptElementKind.constElement]: 21, // Constant
    [ts.ScriptElementKind.letElement]: 6,
    [ts.ScriptElementKind.directory]: 19, // Folder
    [ts.ScriptElementKind.externalModuleName]: 9,
    [ts.ScriptElementKind.jsxAttribute]: 10,
    [ts.ScriptElementKind.string]: 1,
    [ts.ScriptElementKind.link]: 1,
    [ts.ScriptElementKind.linkName]: 1,
    [ts.ScriptElementKind.linkText]: 1,
  };

  return kindMap[tsKind] || 1;
}

/**
 * Handle completion requests
 */
export function handleCompletion(
  service: TypeScriptService,
  document: TextDocument,
  position: Position
): CompletionList | null {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const completions = service.getCompletions(orgFilePath, position);
  if (!completions) return null;

  const items: CompletionItem[] = completions.entries.map((entry, index) => ({
    label: entry.name,
    kind: mapCompletionKind(entry.kind),
    sortText: entry.sortText,
    insertText: entry.insertText || entry.name,
    data: {
      orgFilePath,
      position,
      entryName: entry.name,
      index,
    },
  }));

  return {
    isIncomplete: completions.isIncomplete ?? false,
    items,
  };
}

/**
 * Handle completion resolve requests
 */
export function handleCompletionResolve(
  service: TypeScriptService,
  item: CompletionItem
): CompletionItem {
  if (!item.data) return item;

  const { orgFilePath, position, entryName } = item.data as {
    orgFilePath: string;
    position: Position;
    entryName: string;
  };

  const details = service.getCompletionDetails(
    orgFilePath,
    position,
    entryName
  );

  if (details) {
    // Add documentation
    const documentation = ts.displayPartsToString(details.documentation);
    if (documentation) {
      item.documentation = {
        kind: "markdown",
        value: documentation,
      };
    }

    // Add detail (signature/type)
    const detail = ts.displayPartsToString(details.displayParts);
    if (detail) {
      item.detail = detail;
    }
  }

  return item;
}
