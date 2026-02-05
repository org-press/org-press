/**
 * DTS Generator
 *
 * Generates TypeScript declaration files (.d.ts) for org code blocks.
 * Uses standard TypeScript compiler for build mode generation.
 *
 * Process:
 * 1. Load block manifest from org files
 * 2. Write temporary TypeScript/JavaScript files
 * 3. Run TypeScript compiler to generate declarations
 * 4. Map declarations back to virtual module structure
 * 5. Clean up temporary files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import type {
  BlockManifest,
  BlockInfo,
  DtsGeneratorOptions,
  DtsGenerationResult,
  SerializableManifest,
} from "./types.ts";
import {
  generateBlockManifest,
  filterTsJsBlocks,
  EXTENSION_MAP,
} from "./manifest.ts";

/**
 * TypeScript/JavaScript languages that can generate declarations
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
 * DTS Generator class
 *
 * Generates TypeScript declaration files for org code blocks.
 *
 * @example
 * ```typescript
 * const generator = new DtsGenerator({
 *   contentDir: "content",
 *   outDir: "dist/types",
 * });
 *
 * await generator.loadBlocks();
 * await generator.writeDeclarations();
 * ```
 */
export class DtsGenerator {
  private manifest: BlockManifest | null = null;
  private options: Required<
    Pick<DtsGeneratorOptions, "contentDir" | "projectRoot">
  > &
    DtsGeneratorOptions;
  private tempDir: string;

  constructor(options: DtsGeneratorOptions) {
    this.options = {
      projectRoot: process.cwd(),
      ...options,
    };

    // If contentDir is absolute and projectRoot wasn't explicitly set,
    // try to find a reasonable temp directory location
    const absoluteContentDir = path.isAbsolute(options.contentDir)
      ? options.contentDir
      : path.join(this.options.projectRoot, options.contentDir);

    // Look for a node_modules directory near the content dir
    let tempBase = this.options.projectRoot;
    if (path.isAbsolute(options.contentDir)) {
      // Try parent directories of content dir to find node_modules
      let dir = path.dirname(absoluteContentDir);
      while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, "node_modules"))) {
          tempBase = dir;
          break;
        }
        dir = path.dirname(dir);
      }
      // If no node_modules found, use the content dir's parent
      if (tempBase === this.options.projectRoot) {
        tempBase = path.dirname(absoluteContentDir);
      }
    }

    this.tempDir = path.join(tempBase, "node_modules", ".org-press-dts-temp");
  }

  /**
   * Load blocks from org files
   *
   * Generates a manifest of all code blocks in the content directory.
   * Filters to only TypeScript/JavaScript blocks.
   *
   * @returns Block manifest
   */
  async loadBlocks(): Promise<BlockManifest> {
    const fullManifest = await generateBlockManifest(
      this.options.contentDir,
      this.options.projectRoot
    );

    // Filter to only TS/JS blocks
    this.manifest = filterTsJsBlocks(fullManifest);

    return this.manifest;
  }

  /**
   * Get the file extension for a language
   */
  private getExtension(language: string): string {
    return EXTENSION_MAP[language.toLowerCase()] || "ts";
  }

  /**
   * Write temporary TypeScript/JavaScript files
   *
   * Creates temporary files that the TypeScript compiler can process.
   *
   * @returns Array of created file paths
   */
  private writeTempFiles(): string[] {
    if (!this.manifest) {
      throw new Error("Call loadBlocks() first");
    }

    const files: string[] = [];

    // Clean and create temp directory
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.tempDir, { recursive: true });

    for (const [_filePath, blocks] of this.manifest.blocksByFile) {
      for (const block of blocks) {
        if (!TS_JS_LANGUAGES.includes(block.language.toLowerCase())) {
          continue;
        }

        const ext = this.getExtension(block.language);
        const baseName = block.name || `block-${block.index}`;
        const orgBase = block.orgFilePath.replace(/\.org$/, "");
        const tempPath = path.join(this.tempDir, orgBase, `${baseName}.${ext}`);

        // Create directory structure
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });

        // Write block content
        fs.writeFileSync(tempPath, block.content, "utf-8");
        files.push(tempPath);
      }
    }

    return files;
  }

  /**
   * Generate TypeScript declarations
   *
   * Compiles temporary files and generates .d.ts files.
   *
   * @returns Generation result with declarations and errors
   */
  generateDeclarations(): DtsGenerationResult {
    if (!this.manifest) {
      throw new Error("Call loadBlocks() first");
    }

    const files = this.writeTempFiles();
    const declarations = new Map<string, string>();
    const errors: Array<{ file: string; message: string }> = [];

    if (files.length === 0) {
      return {
        declarations,
        errors,
        manifest: this.manifest,
      };
    }

    // Set up compiler options
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      declaration: true,
      emitDeclarationOnly: true,
      strict: false, // Be lenient - blocks may have implicit any
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: false,
      outDir: this.options.outDir ||
        path.join(this.options.projectRoot, "dist/types"),
      rootDir: this.tempDir,
      // Allow JS files to be processed
      allowJs: true,
      // Don't require explicit return types
      noImplicitReturns: false,
      // Allow unused variables (common in blocks)
      noUnusedLocals: false,
      noUnusedParameters: false,
      ...(this.options.compilerOptions as ts.CompilerOptions),
    };

    // Create program
    const program = ts.createProgram(files, compilerOptions);

    // Collect diagnostics (but be lenient)
    const diagnostics = [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];

    for (const diag of diagnostics) {
      // Only report actual errors, not warnings
      if (diag.category === ts.DiagnosticCategory.Error) {
        const file = diag.file?.fileName || "unknown";
        const relativePath = path.relative(this.tempDir, file);
        errors.push({
          file: relativePath,
          message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
        });
      }
    }

    // Emit declarations
    program.emit(undefined, (fileName, content) => {
      if (fileName.endsWith(".d.ts")) {
        // Map back to output structure
        const outDir =
          compilerOptions.outDir ||
          path.join(this.options.projectRoot, "dist/types");
        const relativePath = path.relative(outDir, fileName);
        declarations.set(relativePath, content);
      }
    });

    return {
      declarations,
      errors,
      manifest: this.manifest,
    };
  }

  /**
   * Write declarations to output directory
   *
   * Generates declarations and writes them to disk along with
   * a block manifest file.
   *
   * @param outDir - Override output directory
   */
  async writeDeclarations(outDir?: string): Promise<void> {
    const result = this.generateDeclarations();
    const targetDir =
      outDir ||
      this.options.outDir ||
      path.join(this.options.projectRoot, "dist/types");

    // Create output directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Write declaration files
    for (const [relativePath, content] of result.declarations) {
      const fullPath = path.join(targetDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
    }

    // Write manifest as JSON
    const manifestJson: SerializableManifest = {
      version: result.manifest.version,
      generatedAt: result.manifest.generatedAt,
      blocks: Array.from(result.manifest.blocksByVirtualId.entries()).map(
        ([id, block]) => ({
          id,
          orgFilePath: block.orgFilePath,
          name: block.name,
          index: block.index,
          language: block.language,
          startLine: block.startLine,
          endLine: block.endLine,
        })
      ),
    };

    const manifestPath = path.join(targetDir, "block-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2), "utf-8");

    // Clean up temp files
    this.cleanup();

    // Report results
    console.log(
      `[org-press] Generated ${result.declarations.size} declaration files`
    );
    if (result.errors.length > 0) {
      console.warn(`[org-press] ${result.errors.length} type errors:`);
      // Show first 5 errors
      for (const err of result.errors.slice(0, 5)) {
        console.warn(`  ${err.file}: ${err.message}`);
      }
      if (result.errors.length > 5) {
        console.warn(`  ... and ${result.errors.length - 5} more`);
      }
    }
  }

  /**
   * Clean up temporary files
   */
  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Get the current manifest
   */
  getManifest(): BlockManifest | null {
    return this.manifest;
  }

  /**
   * Update a single block (for incremental updates)
   *
   * @param block - Updated block info
   */
  updateBlock(block: BlockInfo): void {
    if (!this.manifest) return;

    // Update in blocksByVirtualId
    this.manifest.blocksByVirtualId.set(block.virtualModuleId, block);

    // Update in blocksByFile
    const fileBlocks = this.manifest.blocksByFile.get(block.orgFilePath);
    if (fileBlocks) {
      const index = fileBlocks.findIndex((b) => b.index === block.index);
      if (index !== -1) {
        fileBlocks[index] = block;
      } else {
        fileBlocks.push(block);
      }
    } else {
      this.manifest.blocksByFile.set(block.orgFilePath, [block]);
    }
  }

  /**
   * Remove a block (for incremental updates)
   *
   * @param block - Block to remove
   */
  removeBlock(block: BlockInfo): void {
    if (!this.manifest) return;

    // Remove from blocksByVirtualId
    this.manifest.blocksByVirtualId.delete(block.virtualModuleId);

    // Remove from blocksByFile
    const fileBlocks = this.manifest.blocksByFile.get(block.orgFilePath);
    if (fileBlocks) {
      const index = fileBlocks.findIndex((b) => b.index === block.index);
      if (index !== -1) {
        fileBlocks.splice(index, 1);
      }
      if (fileBlocks.length === 0) {
        this.manifest.blocksByFile.delete(block.orgFilePath);
      }
    }
  }
}
