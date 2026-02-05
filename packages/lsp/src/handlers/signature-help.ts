/**
 * Signature Help Handler
 *
 * Provides function parameter hints while typing.
 */

import type { SignatureHelp, SignatureInformation, ParameterInformation, Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { TypeScriptService } from "../typescript-service.js";
import ts from "typescript";

/**
 * Handle signature help request
 *
 * Shows function/method parameter hints when typing inside parentheses.
 *
 * @param service - TypeScript service
 * @param document - Text document
 * @param position - Cursor position
 * @returns Signature help or null if not applicable
 */
export function handleSignatureHelp(
  service: TypeScriptService,
  document: TextDocument,
  position: Position
): SignatureHelp | null {
  const filePath = document.uri.replace(/^file:\/\//, "");

  const sigHelp = service.getSignatureHelp(filePath, {
    line: position.line,
    character: position.character,
  });

  if (!sigHelp) {
    return null;
  }

  // Convert TypeScript SignatureHelpItems to LSP SignatureHelp
  const signatures: SignatureInformation[] = sigHelp.items.map((item) => {
    // Build the signature label
    const prefixText = ts.displayPartsToString(item.prefixDisplayParts);
    const suffixText = ts.displayPartsToString(item.suffixDisplayParts);
    const separatorText = ts.displayPartsToString(item.separatorDisplayParts);

    const paramLabels = item.parameters.map((param) =>
      ts.displayPartsToString(param.displayParts)
    );

    const label = prefixText + paramLabels.join(separatorText) + suffixText;

    // Build parameter information
    const parameters: ParameterInformation[] = item.parameters.map((param) => {
      const paramLabel = ts.displayPartsToString(param.displayParts);
      const documentation = ts.displayPartsToString(param.documentation);

      return {
        label: paramLabel,
        documentation: documentation || undefined,
      };
    });

    // Build documentation
    const documentation = ts.displayPartsToString(item.documentation);

    return {
      label,
      documentation: documentation || undefined,
      parameters,
    };
  });

  return {
    signatures,
    activeSignature: sigHelp.selectedItemIndex,
    activeParameter: sigHelp.argumentIndex,
  };
}
