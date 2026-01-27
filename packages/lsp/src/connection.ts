/**
 * LSP Connection Handler
 *
 * Sets up the LSP connection over stdio and wires up
 * all handlers to the server.
 */

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DocumentDiagnosticReportKind,
  type InitializeParams,
  type InitializeResult,
  type DocumentDiagnosticParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { OrgPressLspServer, type LspServerOptions } from "./server.js";

/**
 * Create and start the LSP connection
 *
 * @param options - Server options
 * @returns The created connection
 */
export function createLspConnection(options?: LspServerOptions) {
  // Create connection using stdio explicitly
  const connection = createConnection(
    ProposedFeatures.all,
    process.stdin,
    process.stdout
  );

  // Create document manager
  const documents = new TextDocuments(TextDocument);

  // Create server instance
  const server = new OrgPressLspServer(options);

  // Track capabilities
  let hasWorkspaceFolderCapability = false;

  // Handle initialize
  connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
      const capabilities = params.capabilities;

      hasWorkspaceFolderCapability = !!(
        capabilities.workspace && capabilities.workspace.workspaceFolders
      );

      // Get content directory from initialization options
      const initOptions = params.initializationOptions as
        | { contentDir?: string; enableDiagnostics?: boolean; projectRoot?: string }
        | undefined;

      if (initOptions?.contentDir) {
        (server as any).options.contentDir = initOptions.contentDir;
      }
      if (initOptions?.enableDiagnostics !== undefined) {
        (server as any).options.enableDiagnostics =
          initOptions.enableDiagnostics;
      }

      // Initialize the server with the root URI
      // Prefer projectRoot from init options (set by Emacs when .org-press is in a subdirectory)
      let rootUri: string;
      if (initOptions?.projectRoot) {
        // Remove trailing slash if present
        const cleanRoot = initOptions.projectRoot.replace(/\/+$/, "");
        rootUri = `file://${cleanRoot}`;
      } else {
        rootUri =
          params.rootUri ||
          (params.workspaceFolders && params.workspaceFolders[0]?.uri) ||
          `file://${process.cwd()}`;
      }

      try {
        await server.initialize(rootUri);
      } catch (error) {
        console.error("[org-press-lsp] Failed to initialize:", error);
      }

      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: [".", "/", "<", '"', "'", "`", "@"],
          },
          hoverProvider: true,
          definitionProvider: true,
          typeDefinitionProvider: true,
          implementationProvider: true,
          referencesProvider: true,
          // Signature help for function parameters
          signatureHelpProvider: {
            triggerCharacters: ["(", ","],
            retriggerCharacters: [","],
          },
          // Diagnostic support - pull model
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false,
          },
        },
      };
    }
  );

  // Handle initialized notification
  connection.onInitialized(() => {
    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders((_event) => {
        // Workspace folder change event received
      });
    }
  });

  // Document lifecycle events
  documents.onDidOpen((event) => {
    if (event.document.uri.endsWith(".org")) {
      server.onDocumentOpen(event.document);
    }
  });

  documents.onDidChangeContent((change) => {
    if (change.document.uri.endsWith(".org")) {
      server.onDocumentChange(change.document);

      // Send diagnostics after content change
      const diagnostics = server.getDiagnostics(change.document);
      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics,
      });
    }
  });

  documents.onDidClose((event) => {
    if (event.document.uri.endsWith(".org")) {
      server.onDocumentClose(event.document);

      // Clear diagnostics
      connection.sendDiagnostics({
        uri: event.document.uri,
        diagnostics: [],
      });
    }
  });

  // Handle completion
  connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleCompletion(document, params.position);
  });

  // Handle completion resolve
  connection.onCompletionResolve((item) => {
    return server.handleCompletionResolve(item);
  });

  // Handle hover
  connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleHover(document, params.position);
  });

  // Handle go-to-definition
  connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleDefinition(document, params.position);
  });

  // Handle go-to-type-definition
  connection.onTypeDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleTypeDefinition(document, params.position);
  });

  // Handle go-to-implementation
  connection.onImplementation((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleImplementation(document, params.position);
  });

  // Handle find-references
  connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleReferences(document, params.position);
  });

  // Handle signature help (function parameter hints)
  connection.onSignatureHelp((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return null;
    }
    return server.handleSignatureHelp(document, params.position);
  });

  // Handle pull-model diagnostics (LSP 3.17+)
  // This is called by clients that support textDocument/diagnostic
  connection.languages.diagnostics.on((params: DocumentDiagnosticParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document || !document.uri.endsWith(".org")) {
      return {
        kind: DocumentDiagnosticReportKind.Full,
        items: [],
      };
    }
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: server.getDiagnostics(document),
    };
  });

  // Handle shutdown
  connection.onShutdown(() => {
    console.error("[org-press-lsp] Shutting down");
  });

  // Listen for document changes
  documents.listen(connection);

  // Start the connection
  connection.listen();

  console.error("[org-press-lsp] LSP server started");

  return connection;
}
