/**
 * TypeScript Service Wrapper
 *
 * Bridges the virtual file system with org-press block management.
 * Handles loading blocks from manifest and updating virtual files
 * when org documents change.
 */

import ts from "typescript";
import {
  generateBlockManifest,
  extractBlocksFromFile,
  orgToBlock,
  blockToOrg,
  positionToOffset,
  offsetToPosition,
  resolveOrgImport,
  type BlockInfo,
  type BlockManifest,
  type DtsPosition,
} from "org-press";
import { TypeScriptVirtualEnv, type OrgModuleResolver } from "./virtual-fs.js";

/** Position type alias for LSP compatibility */
type Position = DtsPosition;

/**
 * Languages supported for TypeScript services
 */
const TS_JS_LANGUAGES = [
  "typescript",
  "ts",
  "tsx",
  "javascript",
  "js",
  "jsx",
];

/**
 * Map language names to file extensions
 */
const EXTENSION_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  jsx: "jsx",
  tsx: "tsx",
};

/**
 * Options for the TypeScript service
 */
export interface TypeScriptServiceOptions {
  /** Content directory containing org files */
  contentDir: string;
  /** Project root path */
  projectRoot: string;
  /** TypeScript compiler options override */
  compilerOptions?: ts.CompilerOptions;
}

/**
 * TypeScript Service
 *
 * High-level wrapper that:
 * - Manages the virtual TypeScript environment
 * - Loads blocks from org files into virtual files
 * - Maps positions between org files and virtual TypeScript files
 * - Provides LSP-compatible responses
 */
export class TypeScriptService {
  private env: TypeScriptVirtualEnv;
  private manifest: BlockManifest | null = null;
  private options: TypeScriptServiceOptions;

  /** Map virtual file paths to block info */
  private virtualToBlock: Map<string, BlockInfo> = new Map();

  constructor(options: TypeScriptServiceOptions) {
    this.options = options;
    this.env = new TypeScriptVirtualEnv(options.compilerOptions);
  }

  /**
   * Initialize the service by loading all blocks
   */
  async initialize(): Promise<void> {
    this.manifest = await generateBlockManifest(
      this.options.contentDir,
      this.options.projectRoot
    );

    this.syncBlocksToVirtualFs();
  }

  /**
   * Sync blocks from manifest to virtual file system
   */
  private syncBlocksToVirtualFs(): void {
    if (!this.manifest) return;

    // Clear existing virtual files
    this.env.clear();
    this.virtualToBlock.clear();

    for (const [_filePath, blocks] of this.manifest.blocksByFile) {
      for (const block of blocks) {
        if (!this.isTsJsLanguage(block.language)) continue;

        const virtualPath = this.getVirtualPath(block);
        this.env.setFile(virtualPath, block.content);
        this.virtualToBlock.set(virtualPath, block);
      }
    }

    // Set up module resolver for .org?name= imports
    this.setupModuleResolver();
  }

  /**
   * Create and set the module resolver for .org?name= imports
   *
   * This enables TypeScript to resolve imports like:
   *   import { add } from './math.org?name=utils'
   *
   * The resolver uses core's resolveOrgImport function to ensure
   * consistent resolution between Vite plugin and LSP.
   */
  private setupModuleResolver(): void {
    if (!this.manifest) {
      this.env.setModuleResolver(null);
      return;
    }

    const manifest = this.manifest;
    const contentDir = this.options.contentDir;
    const virtualToBlock = this.virtualToBlock;
    const getVirtualPath = this.getVirtualPath.bind(this);

    const resolver: OrgModuleResolver = {
      resolve: (importPath: string, containingFile: string): string | undefined => {
        // Extract the org file path from the containing virtual file
        // Virtual paths are like: /content/utils/block-name.ts
        // We need to find the corresponding block to get the org file path
        const containingBlock = virtualToBlock.get(containingFile);
        const importerOrgPath = containingBlock?.orgFilePath;

        // Resolve using core's resolveOrgImport
        const result = resolveOrgImport(
          importPath,
          importerOrgPath,
          contentDir,
          manifest
        );

        if (!result.ok) {
          // Resolution failed - log for debugging
          console.error(
            `[org-press-lsp] Module resolution failed: ${result.error.message}`
          );
          return undefined;
        }

        // Find the virtual path for the resolved block
        return getVirtualPath(result.resolved.block);
      },
    };

    this.env.setModuleResolver(resolver);
  }

  /**
   * Check if language is TypeScript/JavaScript
   */
  private isTsJsLanguage(language: string): boolean {
    return TS_JS_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * Get virtual file path for a block
   */
  private getVirtualPath(block: BlockInfo): string {
    const ext = EXTENSION_MAP[block.language.toLowerCase()] || "ts";
    const baseName = block.name || `block-${block.index}`;
    const orgBase = block.orgFilePath.replace(/\.org$/, "");
    return `/${orgBase}/${baseName}.${ext}`;
  }

  /**
   * Update blocks for a single org file
   *
   * Called when an org document changes
   */
  updateOrgFile(orgFilePath: string, content: string): void {
    if (!this.manifest) return;

    const relativePath = this.toRelativePath(orgFilePath);

    // Remove old blocks for this file
    const oldBlocks = this.manifest.blocksByFile.get(relativePath) || [];
    for (const block of oldBlocks) {
      const virtualPath = this.getVirtualPath(block);
      this.env.deleteFile(virtualPath);
      this.virtualToBlock.delete(virtualPath);
      this.manifest.blocksByVirtualId.delete(block.virtualModuleId);
    }

    // Extract new blocks
    try {
      const newBlocks = extractBlocksFromFile(
        relativePath,
        this.options.projectRoot
      );

      // Update manifest
      this.manifest.blocksByFile.set(relativePath, newBlocks);
      for (const block of newBlocks) {
        this.manifest.blocksByVirtualId.set(block.virtualModuleId, block);

        if (this.isTsJsLanguage(block.language)) {
          const virtualPath = this.getVirtualPath(block);
          this.env.setFile(virtualPath, block.content);
          this.virtualToBlock.set(virtualPath, block);
        }
      }
    } catch (error) {
      console.error(`[org-press-lsp] Failed to parse ${orgFilePath}:`, error);
    }
  }

  /**
   * Remove blocks for an org file
   */
  removeOrgFile(orgFilePath: string): void {
    if (!this.manifest) return;

    const relativePath = this.toRelativePath(orgFilePath);

    const blocks = this.manifest.blocksByFile.get(relativePath) || [];

    for (const block of blocks) {
      const virtualPath = this.getVirtualPath(block);
      this.env.deleteFile(virtualPath);
      this.virtualToBlock.delete(virtualPath);
      this.manifest.blocksByVirtualId.delete(block.virtualModuleId);
    }

    this.manifest.blocksByFile.delete(relativePath);
  }

  /**
   * Convert absolute path to relative path from project root
   */
  private toRelativePath(filePath: string): string {
    // Normalize both paths (remove trailing slashes, handle multiple slashes)
    const normalizedRoot = this.options.projectRoot.replace(/\/+$/, "");
    const normalizedPath = filePath.replace(/\/+$/, "");

    if (normalizedPath.startsWith(normalizedRoot + "/")) {
      const relative = normalizedPath.slice(normalizedRoot.length + 1);
      return relative;
    }

    return filePath;
  }

  /**
   * Find block containing an org file position
   *
   * @param orgFilePath - Absolute or relative org file path
   * @param position - Position in org file (0-based)
   * @returns Block info and position within block, or null
   */
  findBlockAtPosition(
    orgFilePath: string,
    position: Position
  ): { block: BlockInfo; virtualPath: string; offset: number } | null {
    if (!this.manifest) return null;

    // Convert to relative path for manifest lookup
    const relativePath = this.toRelativePath(orgFilePath);
    const result = orgToBlock(relativePath, position, this.manifest);
    if (!result) return null;

    const block = result.block;
    if (!this.isTsJsLanguage(block.language)) return null;

    const virtualPath = this.getVirtualPath(block);
    const offset = positionToOffset(block.content, result.position);

    return { block, virtualPath, offset };
  }

  /**
   * Map a position in a virtual file back to org file
   *
   * @param virtualPath - Virtual file path
   * @param offset - Character offset in virtual file
   * @returns Org file position or null
   */
  mapToOrgPosition(
    virtualPath: string,
    offset: number
  ): { orgFilePath: string; position: Position } | null {
    if (!this.manifest) return null;

    const block = this.virtualToBlock.get(virtualPath);
    if (!block) return null;

    const blockPosition = offsetToPosition(block.content, offset);
    const result = blockToOrg(
      block.virtualModuleId,
      blockPosition,
      this.manifest
    );

    if (!result) return null;

    return {
      orgFilePath: result.orgFilePath,
      position: result.position,
    };
  }

  /**
   * Get completions for an org file position
   */
  getCompletions(
    orgFilePath: string,
    position: Position
  ): ts.CompletionInfo | null {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return null;

    return (
      this.env.getCompletions(blockInfo.virtualPath, blockInfo.offset) || null
    );
  }

  /**
   * Get completion details
   */
  getCompletionDetails(
    orgFilePath: string,
    position: Position,
    entryName: string
  ): ts.CompletionEntryDetails | null {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return null;

    return (
      this.env.getCompletionDetails(
        blockInfo.virtualPath,
        blockInfo.offset,
        entryName
      ) || null
    );
  }

  /**
   * Get quick info (hover) for an org file position
   */
  getQuickInfo(orgFilePath: string, position: Position): ts.QuickInfo | null {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return null;

    return (
      this.env.getQuickInfo(blockInfo.virtualPath, blockInfo.offset) || null
    );
  }

  /**
   * Get definition locations for an org file position
   */
  getDefinitions(
    orgFilePath: string,
    position: Position
  ): Array<{ orgFilePath: string; position: Position }> {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return [];

    const definitions = this.env.getDefinition(
      blockInfo.virtualPath,
      blockInfo.offset
    );
    if (!definitions) return [];

    const results: Array<{ orgFilePath: string; position: Position }> = [];

    for (const def of definitions) {
      // Check if definition is in a virtual file
      if (def.fileName.startsWith("/") && this.virtualToBlock.has(def.fileName)) {
        const mapped = this.mapToOrgPosition(
          def.fileName,
          def.textSpan.start
        );
        if (mapped) {
          results.push(mapped);
        }
      }
    }

    return results;
  }

  /**
   * Get diagnostics for an org file
   */
  getDiagnostics(orgFilePath: string): Array<{
    message: string;
    severity: "error" | "warning" | "info";
    startPosition: Position;
    endPosition: Position;
  }> {
    if (!this.manifest) return [];

    const relativePath = this.toRelativePath(orgFilePath);
    const blocks = this.manifest.blocksByFile.get(relativePath);
    if (!blocks) return [];

    const results: Array<{
      message: string;
      severity: "error" | "warning" | "info";
      startPosition: Position;
      endPosition: Position;
    }> = [];

    for (const block of blocks) {
      if (!this.isTsJsLanguage(block.language)) continue;

      const virtualPath = this.getVirtualPath(block);
      const diagnostics = this.env.getDiagnostics(virtualPath);

      for (const diag of diagnostics) {
        if (diag.start === undefined || diag.length === undefined) continue;

        // Map diagnostic position back to org file
        const startOffset = diag.start;
        const endOffset = diag.start + diag.length;

        const startPos = offsetToPosition(block.content, startOffset);
        const endPos = offsetToPosition(block.content, endOffset);

        const startOrgResult = blockToOrg(
          block.virtualModuleId,
          startPos,
          this.manifest
        );
        const endOrgResult = blockToOrg(
          block.virtualModuleId,
          endPos,
          this.manifest
        );

        if (!startOrgResult || !endOrgResult) continue;

        let severity: "error" | "warning" | "info";
        switch (diag.category) {
          case ts.DiagnosticCategory.Error:
            severity = "error";
            break;
          case ts.DiagnosticCategory.Warning:
            severity = "warning";
            break;
          default:
            severity = "info";
        }

        results.push({
          message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
          severity,
          startPosition: startOrgResult.position,
          endPosition: endOrgResult.position,
        });
      }
    }

    return results;
  }

  /**
   * Get signature help for an org file position
   */
  getSignatureHelp(
    orgFilePath: string,
    position: Position
  ): ts.SignatureHelpItems | null {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return null;

    return (
      this.env.getSignatureHelp(blockInfo.virtualPath, blockInfo.offset) || null
    );
  }

  /**
   * Get type definition locations for an org file position
   */
  getTypeDefinitions(
    orgFilePath: string,
    position: Position
  ): Array<{ orgFilePath: string; position: Position }> {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return [];

    const definitions = this.env.getTypeDefinition(
      blockInfo.virtualPath,
      blockInfo.offset
    );
    if (!definitions) return [];

    const results: Array<{ orgFilePath: string; position: Position }> = [];

    for (const def of definitions) {
      if (def.fileName.startsWith("/") && this.virtualToBlock.has(def.fileName)) {
        const mapped = this.mapToOrgPosition(def.fileName, def.textSpan.start);
        if (mapped) {
          results.push(mapped);
        }
      }
    }

    return results;
  }

  /**
   * Get references for an org file position
   */
  getReferences(
    orgFilePath: string,
    position: Position
  ): Array<{ orgFilePath: string; position: Position }> {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return [];

    const references = this.env.getReferences(
      blockInfo.virtualPath,
      blockInfo.offset
    );
    if (!references) return [];

    const results: Array<{ orgFilePath: string; position: Position }> = [];

    for (const refSymbol of references) {
      for (const ref of refSymbol.references) {
        if (ref.fileName.startsWith("/") && this.virtualToBlock.has(ref.fileName)) {
          const mapped = this.mapToOrgPosition(ref.fileName, ref.textSpan.start);
          if (mapped) {
            results.push(mapped);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get implementations for an org file position
   */
  getImplementations(
    orgFilePath: string,
    position: Position
  ): Array<{ orgFilePath: string; position: Position }> {
    const blockInfo = this.findBlockAtPosition(orgFilePath, position);
    if (!blockInfo) return [];

    const implementations = this.env.getImplementations(
      blockInfo.virtualPath,
      blockInfo.offset
    );
    if (!implementations) return [];

    const results: Array<{ orgFilePath: string; position: Position }> = [];

    for (const impl of implementations) {
      if (impl.fileName.startsWith("/") && this.virtualToBlock.has(impl.fileName)) {
        const mapped = this.mapToOrgPosition(impl.fileName, impl.textSpan.start);
        if (mapped) {
          results.push(mapped);
        }
      }
    }

    return results;
  }

  /**
   * Get the manifest
   */
  getManifest(): BlockManifest | null {
    return this.manifest;
  }

  /**
   * Get the virtual environment
   */
  getVirtualEnv(): TypeScriptVirtualEnv {
    return this.env;
  }

  /**
   * Get block info for an org file
   */
  getBlocksForFile(orgFilePath: string): BlockInfo[] {
    const relativePath = this.toRelativePath(orgFilePath);
    return this.manifest?.blocksByFile.get(relativePath) || [];
  }
}
