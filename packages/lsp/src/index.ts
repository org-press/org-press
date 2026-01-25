/**
 * @org-press/lsp
 *
 * LSP server for org-press code blocks
 *
 * Provides IDE features (completion, hover, go-to-definition, diagnostics)
 * for code blocks in org-mode files.
 *
 * @example
 * ```typescript
 * import { startLspServer } from "@org-press/lsp";
 *
 * // Start the LSP server over stdio
 * startLspServer({
 *   contentDir: "content",
 *   enableDiagnostics: true,
 * });
 * ```
 */

// Server
export { OrgPressLspServer, type LspServerOptions } from "./server.js";
export { createLspConnection } from "./connection.js";

// TypeScript service
export {
  TypeScriptService,
  type TypeScriptServiceOptions,
} from "./typescript-service.js";

// Virtual file system
export { TypeScriptVirtualEnv, type VirtualFile } from "./virtual-fs.js";

// Handlers (for testing/customization)
export {
  handleCompletion,
  handleCompletionResolve,
  handleHover,
  handleDefinition,
  getDiagnostics,
} from "./handlers/index.js";

// Import for local use
import { createLspConnection as _createLspConnection } from "./connection.js";

/**
 * Start the LSP server
 *
 * This is the main entry point for running the server.
 * It creates a connection over stdio and starts listening.
 *
 * @param options - Server options
 */
export function startLspServer(options?: {
  contentDir?: string;
  enableDiagnostics?: boolean;
}): void {
  _createLspConnection(options);
}
