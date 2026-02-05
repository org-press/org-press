/**
 * LSP Handlers
 *
 * Export all handler functions for the LSP server.
 */

export { handleCompletion, handleCompletionResolve } from "./completion.js";
export { handleHover } from "./hover.js";
export { handleDefinition } from "./definition.js";
export { getDiagnostics } from "./diagnostics.js";
export {
  handleReferences,
  handleTypeDefinition,
  handleImplementation,
} from "./references.js";
export { handleSignatureHelp } from "./signature-help.js";
