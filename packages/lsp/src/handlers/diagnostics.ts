/**
 * LSP Diagnostics Handler
 *
 * Provides type-checking diagnostics for code blocks.
 */

import type {
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { TypeScriptService } from "../typescript-service.js";

/**
 * Map severity strings to LSP severity numbers
 */
function mapSeverity(
  severity: "error" | "warning" | "info"
): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return 1; // Error
    case "warning":
      return 2; // Warning
    case "info":
      return 3; // Information
    default:
      return 4; // Hint
  }
}

/**
 * Get diagnostics for an org file
 */
export function getDiagnostics(
  service: TypeScriptService,
  document: TextDocument
): Diagnostic[] {
  const uri = document.uri;
  const orgFilePath = uri.replace(/^file:\/\//, "");

  const diagnostics = service.getDiagnostics(orgFilePath);

  return diagnostics.map((diag) => ({
    severity: mapSeverity(diag.severity),
    range: {
      start: diag.startPosition,
      end: diag.endPosition,
    },
    message: diag.message,
    source: "org-press-lsp",
  }));
}
