/**
 * Org-Press LSP Server
 *
 * Main LSP server implementation that provides IDE features
 * for code blocks in org files.
 */

import type {
  CompletionItem,
  CompletionList,
  Hover,
  Location,
  Diagnostic,
  Position,
  SignatureHelp,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { TypeScriptService } from "./typescript-service.js";
import {
  handleCompletion,
  handleCompletionResolve,
  handleHover,
  handleDefinition,
  handleReferences,
  handleTypeDefinition,
  handleImplementation,
  handleSignatureHelp,
  getDiagnostics,
} from "./handlers/index.js";

/**
 * Server options
 */
export interface LspServerOptions {
  /** Content directory containing org files */
  contentDir?: string;
  /** Enable diagnostics */
  enableDiagnostics?: boolean;
}

/**
 * Org-Press LSP Server
 *
 * Wraps TypeScript services and provides LSP protocol methods.
 */
export class OrgPressLspServer {
  private service: TypeScriptService | null = null;
  private options: LspServerOptions;
  private projectRoot: string = "";
  private initialized = false;

  constructor(options: LspServerOptions = {}) {
    this.options = {
      contentDir: "content",
      enableDiagnostics: true,
      ...options,
    };
  }

  /**
   * Initialize the server with a project root
   */
  async initialize(rootUri: string): Promise<void> {
    // Convert URI to path
    this.projectRoot = rootUri.startsWith("file://")
      ? rootUri.slice(7)
      : rootUri;

    this.service = new TypeScriptService({
      contentDir: this.options.contentDir!,
      projectRoot: this.projectRoot,
    });

    try {
      await this.service.initialize();
      this.initialized = true;
      console.error("[org-press-lsp] Server initialized");
      console.error(
        `[org-press-lsp] Project root: ${this.projectRoot}`
      );
      console.error(
        `[org-press-lsp] Content dir: ${this.options.contentDir}`
      );

      const manifest = this.service.getManifest();
      if (manifest) {
        console.error(
          `[org-press-lsp] Loaded ${manifest.blocksByVirtualId.size} blocks`
        );
      }
    } catch (error) {
      console.error("[org-press-lsp] Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Handle document open
   */
  onDocumentOpen(document: TextDocument): void {
    if (!this.service) return;

    const uri = document.uri;
    if (!uri.endsWith(".org")) return;

    // Document tracking for future use (e.g., caching)
  }

  /**
   * Handle document change
   */
  onDocumentChange(document: TextDocument): void {
    if (!this.service) return;

    const uri = document.uri;
    if (!uri.endsWith(".org")) return;

    const filePath = uri.replace(/^file:\/\//, "");
    const content = document.getText();

    this.service.updateOrgFile(filePath, content);
  }

  /**
   * Handle document close
   */
  onDocumentClose(document: TextDocument): void {
    if (!this.service) return;

    const uri = document.uri;
    if (!uri.endsWith(".org")) return;

    // Document cleanup for future use (e.g., cache invalidation)
  }

  /**
   * Handle completion request
   */
  handleCompletion(
    document: TextDocument,
    position: Position
  ): CompletionList | null {
    if (!this.service) return null;
    return handleCompletion(this.service, document, position);
  }

  /**
   * Handle completion resolve request
   */
  handleCompletionResolve(item: CompletionItem): CompletionItem {
    if (!this.service) return item;
    return handleCompletionResolve(this.service, item);
  }

  /**
   * Handle hover request
   */
  handleHover(document: TextDocument, position: Position): Hover | null {
    if (!this.service) return null;
    return handleHover(this.service, document, position);
  }

  /**
   * Handle definition request
   */
  handleDefinition(document: TextDocument, position: Position): Location[] {
    if (!this.service) return [];
    return handleDefinition(this.service, document, position, this.projectRoot);
  }

  /**
   * Handle references request
   */
  handleReferences(document: TextDocument, position: Position): Location[] {
    if (!this.service) return [];
    return handleReferences(this.service, document, position, this.projectRoot);
  }

  /**
   * Handle type definition request
   */
  handleTypeDefinition(document: TextDocument, position: Position): Location[] {
    if (!this.service) return [];
    return handleTypeDefinition(this.service, document, position, this.projectRoot);
  }

  /**
   * Handle implementation request
   */
  handleImplementation(document: TextDocument, position: Position): Location[] {
    if (!this.service) return [];
    return handleImplementation(this.service, document, position, this.projectRoot);
  }

  /**
   * Handle signature help request
   */
  handleSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
    if (!this.service) return null;
    return handleSignatureHelp(this.service, document, position);
  }

  /**
   * Get diagnostics for a document
   */
  getDiagnostics(document: TextDocument): Diagnostic[] {
    if (!this.service || !this.options.enableDiagnostics) return [];
    return getDiagnostics(this.service, document);
  }

  /**
   * Get the TypeScript service
   */
  getService(): TypeScriptService | null {
    return this.service;
  }

  /**
   * Get project root
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }
}
