/**
 * Virtual File System for TypeScript
 *
 * Creates an in-memory TypeScript environment that provides
 * language services for org code blocks without writing to disk.
 *
 * This is the core of dev-mode LSP functionality - all TypeScript
 * operations happen in memory for instant feedback.
 */

import ts from "typescript";
import {
  resolveOrgImport,
  isOrgImport,
  type BlockManifest,
} from "org-press";

/**
 * Virtual file in the TypeScript environment
 */
export interface VirtualFile {
  /** Virtual file path */
  path: string;
  /** File content */
  content: string;
  /** Version number for change tracking */
  version: number;
}

/**
 * Module resolver for .org?name= imports
 */
export interface OrgModuleResolver {
  /**
   * Resolve an org import to a virtual file path
   * @param importPath - The import path (e.g., './utils.org?name=helpers')
   * @param containingFile - The file making the import
   * @returns Virtual file path or undefined if not resolved
   */
  resolve(importPath: string, containingFile: string): string | undefined;
}

/**
 * TypeScript Virtual Environment
 *
 * Manages an in-memory TypeScript project that can:
 * - Add/update/remove virtual files
 * - Provide language services (completions, hover, etc.)
 * - Generate type declarations
 *
 * @example
 * ```typescript
 * const env = new TypeScriptVirtualEnv();
 *
 * // Add a virtual file
 * env.setFile("/blocks/utils.ts", "export const add = (a: number, b: number) => a + b;");
 *
 * // Get completions
 * const completions = env.getCompletions("/blocks/utils.ts", 10);
 * ```
 */
export class TypeScriptVirtualEnv {
  /** In-memory file storage */
  private fsMap: Map<string, string>;

  /** Version tracking for incremental updates */
  private versions: Map<string, number>;

  /** Cached TypeScript program */
  private program: ts.Program | null = null;

  /** Cached language service */
  private languageService: ts.LanguageService | null = null;

  /** TypeScript compiler options */
  private compilerOptions: ts.CompilerOptions;

  /** Default library files content cache */
  private libCache: Map<string, string>;

  /** Optional module resolver for .org?name= imports */
  private moduleResolver: OrgModuleResolver | null = null;

  constructor(compilerOptions?: ts.CompilerOptions) {
    this.fsMap = new Map();
    this.versions = new Map();
    this.libCache = new Map();

    this.compilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
      emitDeclarationOnly: true,
      strict: false, // Lenient for code blocks
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: false,
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      ...compilerOptions,
    };
  }

  /**
   * Set the module resolver for .org?name= imports
   *
   * @param resolver - The module resolver to use
   */
  setModuleResolver(resolver: OrgModuleResolver | null): void {
    this.moduleResolver = resolver;
    this.invalidate(); // Clear cache when resolver changes
  }

  /**
   * Add or update a virtual file
   *
   * @param filePath - Virtual file path (should start with /)
   * @param content - File content
   */
  setFile(filePath: string, content: string): void {
    this.fsMap.set(filePath, content);
    const currentVersion = this.versions.get(filePath) || 0;
    this.versions.set(filePath, currentVersion + 1);
    this.invalidate();
  }

  /**
   * Remove a virtual file
   *
   * @param filePath - Virtual file path
   */
  deleteFile(filePath: string): void {
    this.fsMap.delete(filePath);
    this.versions.delete(filePath);
    this.invalidate();
  }

  /**
   * Check if a file exists in the virtual file system
   *
   * @param filePath - File path to check
   * @returns True if file exists
   */
  hasFile(filePath: string): boolean {
    return this.fsMap.has(filePath);
  }

  /**
   * Get all virtual file paths
   *
   * @returns Array of file paths
   */
  getFileNames(): string[] {
    return Array.from(this.fsMap.keys());
  }

  /**
   * Get content of a virtual file
   *
   * @param filePath - Virtual file path
   * @returns File content or undefined
   */
  getFileContent(filePath: string): string | undefined {
    return this.fsMap.get(filePath);
  }

  /**
   * Get version of a virtual file
   *
   * @param filePath - Virtual file path
   * @returns Version number
   */
  getFileVersion(filePath: string): number {
    return this.versions.get(filePath) || 0;
  }

  /**
   * Invalidate cached program and language service
   */
  private invalidate(): void {
    this.program = null;
    this.languageService = null;
  }

  /**
   * Get the TypeScript language service
   *
   * Creates the service lazily and caches it for performance.
   *
   * @returns TypeScript language service
   */
  getLanguageService(): ts.LanguageService {
    if (this.languageService) {
      return this.languageService;
    }

    const self = this;

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => self.getFileNames(),

      getScriptVersion: (fileName) =>
        String(self.versions.get(fileName) || 0),

      getScriptSnapshot: (fileName) => {
        // First check virtual files
        const content = self.fsMap.get(fileName);
        if (content !== undefined) {
          return ts.ScriptSnapshot.fromString(content);
        }

        // Then check real file system for lib files
        if (ts.sys.fileExists(fileName)) {
          const realContent = ts.sys.readFile(fileName);
          if (realContent !== undefined) {
            return ts.ScriptSnapshot.fromString(realContent);
          }
        }

        return undefined;
      },

      getCurrentDirectory: () => "/",

      getCompilationSettings: () => self.compilerOptions,

      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),

      fileExists: (path) => {
        if (self.fsMap.has(path)) return true;
        return ts.sys.fileExists(path);
      },

      readFile: (path) => {
        const content = self.fsMap.get(path);
        if (content !== undefined) return content;
        return ts.sys.readFile(path);
      },

      readDirectory: ts.sys.readDirectory,

      directoryExists: (path) => {
        // Check if any virtual file is in this directory
        for (const filePath of self.fsMap.keys()) {
          if (filePath.startsWith(path + "/")) return true;
        }
        return ts.sys.directoryExists?.(path) ?? false;
      },

      getDirectories: ts.sys.getDirectories,

      // Resolve .org?name= imports using the module resolver
      resolveModuleNames: (
        moduleNames: string[],
        containingFile: string,
        _reusedNames: string[] | undefined,
        _redirectedReference: ts.ResolvedProjectReference | undefined,
        _options: ts.CompilerOptions,
        _containingSourceFile?: ts.SourceFile
      ): (ts.ResolvedModule | undefined)[] => {
        return moduleNames.map((moduleName) => {
          // Check if this is an org import
          if (isOrgImport(moduleName) && self.moduleResolver) {
            const resolved = self.moduleResolver.resolve(moduleName, containingFile);
            if (resolved && self.fsMap.has(resolved)) {
              return {
                resolvedFileName: resolved,
                isExternalLibraryImport: false,
              };
            }
            // If resolver returned a path but file doesn't exist, return undefined
            if (resolved) {
              return undefined;
            }
          }

          // Default TypeScript resolution for non-org imports
          const result = ts.resolveModuleName(
            moduleName,
            containingFile,
            self.compilerOptions,
            {
              fileExists: (path) => self.fsMap.has(path) || ts.sys.fileExists(path),
              readFile: (path) => self.fsMap.get(path) || ts.sys.readFile(path),
            }
          );
          return result.resolvedModule;
        });
      },
    };

    this.languageService = ts.createLanguageService(
      servicesHost,
      ts.createDocumentRegistry()
    );

    return this.languageService;
  }

  /**
   * Get the TypeScript program
   *
   * @returns TypeScript program
   */
  getProgram(): ts.Program {
    if (this.program) {
      return this.program;
    }

    this.program = this.getLanguageService().getProgram()!;
    return this.program;
  }

  /**
   * Get completions at a position
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Completion info or undefined
   */
  getCompletions(
    fileName: string,
    position: number
  ): ts.CompletionInfo | undefined {
    return this.getLanguageService().getCompletionsAtPosition(
      fileName,
      position,
      {
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
        includeCompletionsWithSnippetText: true,
      }
    );
  }

  /**
   * Get completion entry details
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @param entryName - Completion entry name
   * @returns Completion details or undefined
   */
  getCompletionDetails(
    fileName: string,
    position: number,
    entryName: string
  ): ts.CompletionEntryDetails | undefined {
    return this.getLanguageService().getCompletionEntryDetails(
      fileName,
      position,
      entryName,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  /**
   * Get quick info (hover) at a position
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Quick info or undefined
   */
  getQuickInfo(fileName: string, position: number): ts.QuickInfo | undefined {
    return this.getLanguageService().getQuickInfoAtPosition(fileName, position);
  }

  /**
   * Get definition locations
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Definition info array or undefined
   */
  getDefinition(
    fileName: string,
    position: number
  ): readonly ts.DefinitionInfo[] | undefined {
    return this.getLanguageService().getDefinitionAtPosition(
      fileName,
      position
    );
  }

  /**
   * Get type definition locations
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Type definition info array or undefined
   */
  getTypeDefinition(
    fileName: string,
    position: number
  ): readonly ts.DefinitionInfo[] | undefined {
    return this.getLanguageService().getTypeDefinitionAtPosition(
      fileName,
      position
    );
  }

  /**
   * Get diagnostics for a file
   *
   * @param fileName - Virtual file name
   * @returns Array of diagnostics
   */
  getDiagnostics(fileName: string): ts.Diagnostic[] {
    const ls = this.getLanguageService();
    return [
      ...ls.getSyntacticDiagnostics(fileName),
      ...ls.getSemanticDiagnostics(fileName),
    ];
  }

  /**
   * Get all diagnostics for all files
   *
   * @returns Map of file name to diagnostics
   */
  getAllDiagnostics(): Map<string, ts.Diagnostic[]> {
    const result = new Map<string, ts.Diagnostic[]>();

    for (const fileName of this.getFileNames()) {
      const diagnostics = this.getDiagnostics(fileName);
      if (diagnostics.length > 0) {
        result.set(fileName, diagnostics);
      }
    }

    return result;
  }

  /**
   * Get signature help at a position
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Signature help items or undefined
   */
  getSignatureHelp(
    fileName: string,
    position: number
  ): ts.SignatureHelpItems | undefined {
    return this.getLanguageService().getSignatureHelpItems(
      fileName,
      position,
      {}
    );
  }

  /**
   * Get references to a symbol
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Referenced symbols or undefined
   */
  getReferences(
    fileName: string,
    position: number
  ): ts.ReferencedSymbol[] | undefined {
    return this.getLanguageService().findReferences(fileName, position);
  }

  /**
   * Get implementations of a symbol
   *
   * @param fileName - Virtual file name
   * @param position - Character offset in file
   * @returns Implementation locations or undefined
   */
  getImplementations(
    fileName: string,
    position: number
  ): readonly ts.ImplementationLocation[] | undefined {
    return this.getLanguageService().getImplementationAtPosition(
      fileName,
      position
    );
  }

  /**
   * Generate type declarations for all virtual files
   *
   * @returns Map of declaration file name to content
   */
  generateDeclarations(): Map<string, string> {
    const declarations = new Map<string, string>();
    const program = this.getProgram();

    program.emit(undefined, (fileName, content) => {
      if (fileName.endsWith(".d.ts")) {
        declarations.set(fileName, content);
      }
    });

    return declarations;
  }

  /**
   * Clear all virtual files
   */
  clear(): void {
    this.fsMap.clear();
    this.versions.clear();
    this.invalidate();
  }
}
