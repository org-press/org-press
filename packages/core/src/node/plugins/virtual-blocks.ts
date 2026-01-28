/**
 * Vite Plugin for Virtual Module Blocks (org-press)
 *
 * Handles virtual:org-press:block:... imports for org-press blocks.
 * Resolves .org?name= and .org?index= queries to virtual modules.
 *
 * Features:
 * - Named block support (#+NAME: directives)
 * - Plugin-based transformations
 * - HMR for .org file changes
 * - Caching for performance
 */

import type { Plugin } from "vite";
import { transformWithEsbuild } from "vite";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const { writeFileSync, unlinkSync, mkdirSync, existsSync } = fs;

import type { BlockPlugin, CodeBlock, TransformContext } from "../../plugins/types.ts";
import { parseBlockParameters, createVirtualModuleId as createVMID } from "../../plugins/utils.ts";
import { findMatchingPlugin } from "../../plugins/loader.ts";
import { extractMetadata } from "../../parser/metadata.ts";
import {
  isOrgImport,
  parseOrgImportQuery,
  resolveOrgPath,
} from "../../resolve/org-imports.ts";

// Create require function for ESM compatibility
const require = createRequire(import.meta.url);

/**
 * Transform TypeScript/TSX/JSX code to JavaScript using Vite's transformWithEsbuild
 *
 * Uses Vite's internal esbuild integration for consistency with Vite's pipeline.
 * The filename extension determines the loader (e.g., "file.ts" → TypeScript).
 *
 * Used for:
 * - Server-side execution (executeServerCode)
 * - Client-side virtual modules (Vite doesn't auto-transpile virtual modules)
 */
async function transformTypeScript(code: string, loader: "ts" | "tsx" | "jsx"): Promise<string> {
  // Vite's transformWithEsbuild determines loader from filename extension
  const filename = `virtual-block.${loader}`;
  const result = await transformWithEsbuild(code, filename, {
    target: "esnext",
    format: "esm",
  });
  return result.code;
}

/**
 * Check if a value is a React element
 */
function isReactElement(value: any): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const reactElementSymbol = Symbol.for("react.element");
  const reactTransitionalElementSymbol = Symbol.for("react.transitional.element");
  return (
    value.$$typeof === reactElementSymbol ||
    value.$$typeof === reactTransitionalElementSymbol
  );
}

/**
 * Render a React element to HTML string
 */
async function renderReactElementToHtml(element: any): Promise<string> {
  try {
    const ReactDOMServer = await import("react-dom/server");
    return ReactDOMServer.renderToStaticMarkup(element);
  } catch (error) {
    console.error("[virtual-blocks] Failed to render React element:", error);
    return `<div class="error">Failed to render React element</div>`;
  }
}

/**
 * Check if code uses ES module syntax (export/import)
 */
function usesModuleSyntax(code: string): boolean {
  // Match: export default, export const, export let, export var, export function, export class, export async
  if (/\bexport\s+(default|const|let|var|function|class|async)\b/.test(code)) {
    return true;
  }
  // Match: export { ... } (used by esbuild when transpiling TypeScript)
  if (/\bexport\s*\{/.test(code)) {
    return true;
  }
  // Match: import statements at start of line
  if (/^import\s+/m.test(code)) {
    return true;
  }
  return false;
}

/**
 * Default render function code for hydration
 *
 * This is added to blocks that don't have a custom render export.
 * The render function handles rendering different result types to the DOM.
 */
const DEFAULT_RENDER_CODE = `
function render(result, el) {
  if (result === null || result === undefined) return;
  if (typeof result === "function") { result(el.id); return; }
  if (result instanceof HTMLElement) { if (!el.hasChildNodes()) el.appendChild(result); return; }
  if (typeof result === "string") {
    if (result.trim().startsWith("<")) { el.innerHTML = result; }
    else { el.textContent = result; }
    return;
  }
  if (typeof result === "number" || typeof result === "boolean") { el.textContent = String(result); return; }
  if (typeof result === "object") { el.innerHTML = "<pre>" + JSON.stringify(result, null, 2) + "</pre>"; return; }
  el.textContent = String(result);
}
export { render };
`.trim();

/**
 * Check if code already exports a render function
 */
function hasRenderExport(code: string): boolean {
  return /export\s+(?:const|function|{[^}]*render[^}]*})/.test(code) &&
         /\brender\b/.test(code);
}

/**
 * Convert legacy code with return statements to ES module format
 */
function convertToModuleFormat(code: string): string {
  if (usesModuleSyntax(code)) {
    return code;
  }
  return `
const __result = await (async () => {
${code}
})();
export default __result;
`;
}

/**
 * Execute server-side code and return the serialized result
 *
 * For blocks with :use server, we execute the code in Node.js
 * and return `export default <serialized-result>` so clients can import it.
 *
 * If the result is a React element, it's rendered to HTML string.
 */
async function executeServerCode(code: string, language: string = "javascript"): Promise<string> {
  const tempDir = path.join(process.cwd(), ".org-press-cache", "server-exec");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const moduleId = randomUUID().replace(/-/g, "");
  const tempFile = path.join(tempDir, `${moduleId}.mjs`);

  try {
    // Transpile TypeScript if needed
    let transpiledCode = code;
    const tsLanguages = ["typescript", "ts", "tsx", "jsx"];
    if (tsLanguages.includes(language.toLowerCase())) {
      const loader = language.toLowerCase() === "tsx" ? "tsx"
                   : language.toLowerCase() === "jsx" ? "jsx"
                   : "ts";
      transpiledCode = await transformTypeScript(code, loader as "ts" | "tsx" | "jsx");
    }

    const moduleCode = convertToModuleFormat(transpiledCode);

    const wrappedCode = `
const require = globalThis.__orgpress_require_${moduleId};
const process = globalThis.__orgpress_process_${moduleId};
${moduleCode}
`;

    writeFileSync(tempFile, wrappedCode, "utf-8");

    (globalThis as any)[`__orgpress_require_${moduleId}`] = require;
    (globalThis as any)[`__orgpress_process_${moduleId}`] = process;

    const moduleUrl = `file://${tempFile}`;
    const module = await import(moduleUrl);

    delete (globalThis as any)[`__orgpress_require_${moduleId}`];
    delete (globalThis as any)[`__orgpress_process_${moduleId}`];

    const result = module.default !== undefined ? module.default : module;

    // Handle React elements - render to HTML
    if (isReactElement(result)) {
      const html = await renderReactElementToHtml(result);
      return `export default ${JSON.stringify(html)};`;
    }

    // Serialize the result
    const serialized = JSON.stringify(result);
    return `export default ${serialized};`;
  } catch (error: any) {
    console.error('[virtual-blocks] Server execution error:', error.message);
    return `export default { error: ${JSON.stringify(error.message)} };`;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Cache for parsed org files
 */
const astCache = new Map<string, OrgData>();

/**
 * Cache for transformed block code
 */
const blockCache = new Map<string, string>();

/**
 * Virtual module ID components
 */
interface VirtualModuleId {
  orgFilePath: string;
  blockIndex?: number;
  blockName?: string;
  extension: string;
  parser?: string;
}

/**
 * Parse virtual module ID
 *
 * Format: "virtual:org-press:block:parser:content/foo.org:5.js"
 * or "virtual:org-press:block:parser:content/foo.org:NAME:my-block.js"
 *
 * @param id Virtual module ID (with or without \0 prefix)
 * @returns Parsed components or null if invalid
 */
function parseVirtualModuleId(id: string): VirtualModuleId | null {
  // Remove \0 prefix if present
  const cleanId = id.startsWith("\0") ? id.slice(1) : id;

  if (!cleanId.startsWith("virtual:org-press:block:")) {
    return null;
  }

  // Try index-based format WITH extension: virtual:org-press:block:parser:path/to/file.org:index.ext
  let match = cleanId.match(/^virtual:org-press:block:([^:]+):(.+):(\d+)\.(\w+)$/);
  if (match) {
    const [, parser, orgFilePath, blockIndexStr, extension] = match;
    return {
      parser,
      orgFilePath,
      blockIndex: parseInt(blockIndexStr, 10),
      extension,
    };
  }

  // Try index-based format WITHOUT extension: virtual:org-press:block:parser:path/to/file.org:index
  match = cleanId.match(/^virtual:org-press:block:([^:]+):(.+):(\d+)$/);
  if (match) {
    const [, parser, orgFilePath, blockIndexStr] = match;
    return {
      parser,
      orgFilePath,
      blockIndex: parseInt(blockIndexStr, 10),
      extension: "js",
    };
  }

  // Try name-based format WITH extension: virtual:org-press:block:parser:path/to/file.org:NAME:block-name.ext
  match = cleanId.match(/^virtual:org-press:block:([^:]+):(.+):NAME:([^.:]+)\.(\w+)$/);
  if (match) {
    const [, parser, orgFilePath, blockName, extension] = match;
    return {
      parser,
      orgFilePath,
      blockName,
      extension,
    };
  }

  // Try name-based format WITHOUT extension: virtual:org-press:block:parser:path/to/file.org:NAME:block-name
  match = cleanId.match(/^virtual:org-press:block:([^:]+):(.+):NAME:([^:]+)$/);
  if (match) {
    const [, parser, orgFilePath, blockName] = match;
    return {
      parser,
      orgFilePath,
      blockName,
      extension: "js",
    };
  }

  return null;
}

/**
 * Extract code blocks from org AST with names from #+name: directives
 *
 * @param ast Parsed org AST
 * @param orgContent Raw org file content
 * @returns Array of code blocks with metadata
 */
function extractCodeBlocks(ast: OrgData, orgContent: string): Array<{
  language: string;
  value: string;
  meta: string;
  name?: string;
  index: number;
}> {
  const blocks: Array<{
    language: string;
    value: string;
    meta: string;
    name?: string;
    index: number;
  }> = [];

  let blockIndex = 0;

  // First, extract block names from the raw org content
  const lines = orgContent.split("\n");
  const blockMetadata: Array<{ name?: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a begin_src line
    if (line.match(/^\s*#\+begin_src/i)) {
      let blockName: string | undefined = undefined;

      // Look backwards for a #+name: directive
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        const nameMatch = prevLine.match(/^\s*#\+name:\s*(.+)/i);
        if (nameMatch) {
          blockName = nameMatch[1].trim();
          break;
        }
        // Stop if we hit a non-comment, non-empty line
        if (prevLine.trim() && !prevLine.trim().startsWith("#")) {
          break;
        }
      }

      blockMetadata.push({ name: blockName, line: i });
    }
  }

  // Now traverse the AST and match blocks with their metadata
  let metadataIndex = 0;

  function traverse(node: any) {
    if (node.type === "src-block") {
      const metadata = blockMetadata[metadataIndex];

      // Check for :name in block parameters as well as #+NAME: directive
      const params = parseBlockParameters(node.parameters || "");
      const blockName = metadata?.name || params.name;

      blocks.push({
        language: node.language || "",
        value: node.value || "",
        meta: node.parameters || "",
        name: blockName,
        index: blockIndex,
      });

      blockIndex++;
      metadataIndex++;
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return blocks;
}

/**
 * Parse org file and extract blocks
 *
 * @param filePath Absolute path to .org file
 * @returns AST and content
 */
function parseOrgFile(filePath: string): { ast: OrgData; content: string } {
  const content = fs.readFileSync(filePath, "utf-8");

  if (astCache.has(filePath)) {
    return { ast: astCache.get(filePath)!, content };
  }

  const ast = parse(content) as OrgData;
  astCache.set(filePath, ast);

  return { ast, content };
}

/**
 * Options for virtual blocks plugin
 */
interface VirtualBlocksOptions {
  /** Build or serve mode */
  command: "build" | "serve";
  /** Development or production mode */
  mode: string;
  /** Org-press configuration (optional, will be loaded if not provided) */
  config?: any;
}

/**
 * Generate a virtual module for a full .org file import
 */
function generateOrgImportModule(
  fullPath: string,
  orgFilePath: string,
  plugins: BlockPlugin[],
  options: VirtualBlocksOptions
): string {
  // Parse org file
  const { ast, content } = parseOrgFile(fullPath);

  // Extract blocks
  const blocks = extractCodeBlocks(ast, content);

  // Extract metadata
  const metadata = extractMetadata(ast);

  // Generate imports for each block's virtual module
  const blockImports: string[] = [];
  const blockDefinitions: string[] = [];
  const namedExports: string[] = [];
  const namedBlocksEntries: string[] = [];

  blocks.forEach((block, idx) => {
    const params = parseBlockParameters(block.meta);
    // Get the :use value and extract the plugin name (first part before pipe)
    const useValue = params.use || "";
    const useFirstPart = useValue.split("|")[0].trim();
    // Use the plugin name from :use, or "default" for language-based matching
    const parser = useFirstPart || "default";

    const EXTENSION_MAP: Record<string, string> = {
      javascript: "js", js: "js",
      typescript: "ts", ts: "ts",
      jsx: "jsx", tsx: "tsx",
      json: "js",
    };
    const extension = EXTENSION_MAP[block.language.toLowerCase()] || "js";

    const blockVirtualId = block.name
      ? `virtual:org-press:block:${parser}:${orgFilePath}:NAME:${block.name}.${extension}`
      : `virtual:org-press:block:${parser}:${orgFilePath}:${idx}.${extension}`;

    const importName = `__block_${idx}`;
    blockImports.push(`import * as ${importName} from "${blockVirtualId}";`);

    const blockDef = `{
    name: ${block.name ? JSON.stringify(block.name) : "undefined"},
    code: ${JSON.stringify(block.value)},
    language: ${JSON.stringify(block.language)},
    index: ${idx},
    parameters: ${JSON.stringify(parseBlockParameters(block.meta))},
    exports: ${importName}.default !== undefined ? ${importName}.default : ${importName}
  }`;

    blockDefinitions.push(blockDef);

    if (block.name) {
      const jsIdentifier = block.name.replace(/-/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      namedBlocksEntries.push(`${JSON.stringify(block.name)}: __blocks[${idx}]`);
      namedExports.push(`export const ${jsIdentifier} = __blocks[${idx}];`);
    }
  });

  // HTML placeholder - full implementation would call renderOrg()
  const htmlPlaceholder = '""';

  return `
// Auto-generated org-import module for: ${orgFilePath}
${blockImports.join("\n")}

const __metadata = ${JSON.stringify(metadata, null, 2)};

const __blocks = [
  ${blockDefinitions.join(",\n  ")}
];

const __namedBlocks = {
  ${namedBlocksEntries.join(",\n  ")}
};

const __html = ${htmlPlaceholder};

export default {
  html: __html,
  metadata: __metadata,
  blocks: __blocks,
  namedBlocks: __namedBlocks
};

${namedExports.join("\n")}
`;
}

/**
 * Create Vite plugin for virtual module blocks
 *
 * @param plugins Array of block plugins
 * @param options Plugin options
 * @returns Vite plugin
 */
export function createVirtualBlocksPlugin(
  plugins: BlockPlugin[],
  options: VirtualBlocksOptions
): Plugin {
  return {
    name: "org-press:virtual-blocks",
    enforce: "pre",

    resolveId(id: string, importer: string | undefined) {
      // Handle org-press/client/* imports - resolve to actual file paths
      if (id === "org-press/client/hydrate-runtime") {
        // Resolve to the client folder in the org-press package
        // Try multiple locations since the file could be in src/ or dist/
        try {
          const pkgPath = require.resolve("org-press/package.json");
          const pkgDir = path.dirname(pkgPath);
          const srcPath = path.join(pkgDir, "src/client/hydrate-runtime.ts");
          const distPath = path.join(pkgDir, "dist/client/hydrate-runtime.ts");
          if (existsSync(srcPath)) return srcPath;
          if (existsSync(distPath)) return distPath;
        } catch {
          // Fallback if package.json resolution fails
        }

        // Fallback: resolve relative to bundled location (packages/core/dist)
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        const distClientPath = path.resolve(currentDir, "client/hydrate-runtime.ts");
        const srcClientPath = path.resolve(currentDir, "../src/client/hydrate-runtime.ts");
        if (existsSync(distClientPath)) return distClientPath;
        if (existsSync(srcClientPath)) return srcClientPath;
        return distClientPath; // Return anyway, let Vite report the error
      }

      // Handle virtual:org-press:block:{parser}:... imports
      if (id.startsWith("virtual:org-press:block:")) {
        // Use \0 prefix to mark as virtual module
        return "\0" + id;
      }

      // Handle .org?name= and .org?index= imports
      if (isOrgImport(id) && id.includes("?")) {
        // Parse query parameters (supports both ?name= and ?index=)
        const queryIndex = id.indexOf("?");
        const orgPath = id.slice(0, queryIndex);
        const queryString = id.slice(queryIndex + 1);
        const params = new URLSearchParams(queryString);

        const blockName = params.get("name");
        const blockIndexStr = params.get("index");
        const isDataImport = params.has("data");

        // Must have either name or index
        if (!blockName && blockIndexStr === null) {
          return null;
        }

        // Get importer path for resolution
        // For virtual modules, extract the org file path
        let importerPath: string | undefined;
        if (importer) {
          if (importer.includes("virtual:org-press:block:")) {
            const parsed = parseVirtualModuleId(importer);
            if (parsed) {
              importerPath = parsed.orgFilePath;
            } else {
              console.warn(
                `[virtual-blocks] Could not parse virtual module importer: ${importer}`
              );
              return null;
            }
          } else {
            // For regular files, convert to content-relative path
            importerPath = path.relative(process.cwd(), importer);
          }
        }

        // Use centralized path resolution
        // Note: contentDir is process.cwd() for Vite plugin
        const resolvedRelativePath = resolveOrgPath(
          orgPath,
          importerPath,
          process.cwd()
        );

        if (!resolvedRelativePath) {
          console.warn(
            `[virtual-blocks] Cannot resolve org path '${orgPath}' from '${importer || "unknown"}'`
          );
          return null;
        }

        // Resolve to absolute path and check existence
        const resolvedOrgPath = path.resolve(process.cwd(), resolvedRelativePath);

        if (!fs.existsSync(resolvedOrgPath)) {
          console.warn(
            `[virtual-blocks] Org file not found: ${resolvedOrgPath}`
          );
          return null;
        }

        // Parse org file and extract blocks (uses cache)
        const { ast, content } = parseOrgFile(resolvedOrgPath);
        const blocks = extractCodeBlocks(ast, content);

        // Find the target block by name or index
        let targetBlock: typeof blocks[0] | undefined;
        let targetIndex: number;

        if (blockName) {
          // Find by name
          const foundIndex = blocks.findIndex((b) => b.name === blockName);
          if (foundIndex === -1) {
            const availableNames = blocks.filter(b => b.name).map(b => b.name).join(", ");
            console.warn(
              `[virtual-blocks] Block '${blockName}' not found in ${resolvedRelativePath}. Available: ${availableNames || "(none)"}`
            );
            return null;
          }
          targetBlock = blocks[foundIndex];
          targetIndex = foundIndex;
        } else {
          // Find by index
          const blockIndex = parseInt(blockIndexStr!, 10);
          if (blockIndex >= blocks.length) {
            console.warn(
              `[virtual-blocks] Block index ${blockIndex} out of bounds (found ${blocks.length} blocks in ${resolvedRelativePath})`
            );
            return null;
          }
          targetBlock = blocks[blockIndex];
          targetIndex = blockIndex;
        }

        // Determine extension based on block language
        const EXTENSION_MAP: Record<string, string> = {
          javascript: "js",
          js: "js",
          typescript: "ts",
          ts: "ts",
          jsx: "jsx",
          tsx: "tsx",
          css: "css",
          scss: "scss",
          sass: "sass",
          less: "less",
        };
        const extension =
          EXTENSION_MAP[targetBlock.language.toLowerCase()] || "js";

        // Convert to virtual module ID with proper extension for Vite
        // Use 'data' parser prefix for data imports, 'default' for render imports
        const parserPrefix = isDataImport ? "data" : "default";

        // Use name-based ID if block has a name, otherwise use index-based ID
        const virtualId = targetBlock.name
          ? `virtual:org-press:block:${parserPrefix}:${resolvedRelativePath}:NAME:${targetBlock.name}.${extension}`
          : `virtual:org-press:block:${parserPrefix}:${resolvedRelativePath}:${targetIndex}.${extension}`;
        return "\0" + virtualId;
      }

      // Handle bare .org imports (no query params)
      if (id.endsWith('.org') && !id.includes('?') && !id.includes('virtual:')) {
        // Get importer path for resolution
        let importerPath: string | undefined;
        if (importer) {
          if (importer.includes("virtual:org-press:block:")) {
            const parsed = parseVirtualModuleId(importer);
            if (parsed) {
              importerPath = parsed.orgFilePath;
            } else {
              return null;
            }
          } else {
            importerPath = path.relative(process.cwd(), importer);
          }
        }

        // Use centralized path resolution
        const resolvedRelativePath = resolveOrgPath(id, importerPath, process.cwd());

        if (!resolvedRelativePath) {
          console.warn(`[virtual-blocks] Cannot resolve relative path without importer: ${id}`);
          return null;
        }

        const resolvedOrgPath = path.resolve(process.cwd(), resolvedRelativePath);

        if (!fs.existsSync(resolvedOrgPath)) {
          return null;
        }

        return "\0org-import:" + resolvedRelativePath;
      }

      return null;
    },

    async load(id: string) {
      // Handle full org file imports: import org from './file.org'
      if (id.startsWith("\0org-import:")) {
        const orgFilePath = id.slice("\0org-import:".length);
        const fullPath = path.resolve(process.cwd(), orgFilePath);

        if (!fs.existsSync(fullPath)) {
          this.error(`Org file not found: ${orgFilePath}`);
          return null;
        }

        const code = generateOrgImportModule(fullPath, orgFilePath, plugins, options);
        return { code, moduleSideEffects: false };
      }

      // Only handle our virtual modules
      if (!id.startsWith("\0virtual:org-press:block:")) {
        return null;
      }

      // Parse virtual module ID
      const parsed = parseVirtualModuleId(id);
      if (!parsed) {
        this.error(`Invalid virtual module ID: ${id}`);
        return null;
      }

      const { orgFilePath, blockIndex, blockName, extension, parser } = parsed;

      // Check cache (include parser to differentiate wrapper vs model modules)
      const cacheKey = blockName
        ? `${parser}:${orgFilePath}:NAME:${blockName}`
        : `${parser}:${orgFilePath}:${blockIndex}`;
      if (blockCache.has(cacheKey)) {
        return blockCache.get(cacheKey);
      }

      // Resolve org file path (relative to project root)
      const fullPath = path.resolve(process.cwd(), orgFilePath);

      if (!fs.existsSync(fullPath)) {
        this.error(`Org file not found: ${orgFilePath}`);
        return null;
      }

      // Parse org file (cached)
      const { ast, content } = parseOrgFile(fullPath);

      // Extract blocks (with names)
      const blocks = extractCodeBlocks(ast, content);

      // Find the block (by index or name)
      let block: typeof blocks[0] | undefined;
      let actualBlockIndex: number;

      if (blockName) {
        // Find by name
        const foundIndex = blocks.findIndex((b) => b.name === blockName);
        if (foundIndex === -1) {
          this.error(
            `Block with name "${blockName}" not found in ${orgFilePath}. Available blocks: ${blocks
              .filter((b) => b.name)
              .map((b) => b.name)
              .join(", ")}`
          );
          return null;
        }
        block = blocks[foundIndex];
        actualBlockIndex = foundIndex;
      } else if (blockIndex !== undefined) {
        // Find by index
        if (blockIndex >= blocks.length) {
          this.error(
            `Block index ${blockIndex} out of bounds (found ${blocks.length} blocks in ${orgFilePath})`
          );
          return null;
        }
        block = blocks[blockIndex];
        actualBlockIndex = blockIndex;
      } else {
        this.error(
          `No block index or name specified in virtual module ID: ${id}`
        );
        return null;
      }

      // Handle 'data' parser - returns raw data without plugin transformations
      // Used for importing block data to compose with other blocks
      if (parser === "data") {
        const blockLang = block.language.toLowerCase();
        let code: string;

        if (blockLang === "json") {
          // JSON: export parsed object
          code = `export default ${block.value};`;
        } else if (["javascript", "js", "typescript", "ts", "jsx", "tsx"].includes(blockLang)) {
          // JS/TS: return raw code (may have its own exports)
          code = block.value;
        } else {
          // Other: export as string
          code = `export default ${JSON.stringify(block.value)};`;
        }

        blockCache.set(cacheKey, code);
        return { code, moduleSideEffects: false };
      }

      // Special handling for -model and -data parsers (e.g., jscad-model, excalidraw-data)
      // These return the raw code WITHOUT plugin transformations
      // The .org?name=... imports will be resolved by the virtual module system
      if (parser && (parser.endsWith("-model") || parser.endsWith("-data"))) {
        const suffix = parser.endsWith("-model") ? "-model" : "-data";
        const baseParser = parser.slice(0, -suffix.length);

        // Parse block parameters to check :use
        const params = parseBlockParameters(block.meta);

        // Verify the block uses the base parser (extract mode from pipe syntax)
        const useMode = (params.use || "").split("|")[0].trim();
        if (useMode !== baseParser) {
          this.error(
            `Cannot use ${parser} parser for block that doesn't use :use ${baseParser}`
          );
          return null;
        }

        const blockLang = block.language.toLowerCase();

        // JSON blocks: export parsed JSON
        if (blockLang === "json") {
          const code = `export default ${block.value};`;
          blockCache.set(cacheKey, code);
          return { code, moduleSideEffects: false };
        }

        // JavaScript/TypeScript: return raw code (imports will be resolved)
        blockCache.set(cacheKey, block.value);
        return { code: block.value, moduleSideEffects: false };
      }

      // Parse block parameters
      const params = parseBlockParameters(block.meta);

      // Check for :use parameter - extract the plugin name (first part before pipe)
      const useValue = params.use || "";
      const useFirstPart = useValue.split("|")[0].trim();
      // Use the :use plugin name, or fall back to parser from VM ID, or "default"
      const pluginName = useFirstPart || parser || "default";

      // Special handling for server blocks (:use server)
      // When imported via virtual modules, we need to execute and return the result
      // (not delegate to the server plugin's transform which returns a no-op)
      if (pluginName === "server") {
        const JS_LANGUAGES = ["javascript", "js", "typescript", "ts", "jsx", "tsx"];
        const blockLang = block.language.toLowerCase();

        if (JS_LANGUAGES.includes(blockLang)) {
          // Execute server-side and return serialized result
          const code = await executeServerCode(block.value, blockLang);
          blockCache.set(cacheKey, code);
          return code;
        }
      }


      if (!pluginName || pluginName === "default") {
        // No :use specified - determine how to export based on language
        // Note: Vite doesn't automatically transpile virtual modules,
        // so we use transformWithEsbuild for TypeScript/TSX/JSX.
        //
        // For blocks that will be hydrated, we add the render export.

        const JS_TS_LANGUAGES = ["javascript", "js", "typescript", "ts", "jsx", "tsx"];
        const CSS_LANGUAGES = ["css", "scss", "sass", "less", "stylus", "styl", "pcss", "postcss"];

        const blockLang = block.language.toLowerCase();
        let code: string;

        if (JS_TS_LANGUAGES.includes(blockLang)) {
          // JavaScript/TypeScript/JSX/TSX
          code = block.value;

          // Transpile TypeScript/TSX/JSX using Vite's transformWithEsbuild
          // Vite doesn't auto-transpile virtual modules, so we do it manually
          const needsTranspilation = ["ts", "tsx", "jsx"].includes(extension);
          if (needsTranspilation) {
            const loader = extension as "ts" | "tsx" | "jsx";
            code = await transformTypeScript(code, loader);
          }

          // Add default render export if not already present
          // This ensures all blocks can be hydrated using the render pattern
          if (!hasRenderExport(code)) {
            code = `${code}\n\n${DEFAULT_RENDER_CODE}`;
          }
        } else if (CSS_LANGUAGES.includes(blockLang)) {
          // CSS blocks: return raw CSS (no render needed)
          code = block.value;
        } else if (blockLang === "json") {
          // JSON blocks: export parsed JSON with render
          code = `export default ${block.value};\n\n${DEFAULT_RENDER_CODE}`;
        } else {
          // YAML, text, etc.: return as string literal with render
          code = `export default ${JSON.stringify(block.value)};\n\n${DEFAULT_RENDER_CODE}`;
        }

        blockCache.set(cacheKey, code);
        return code;
      }

      // Find plugin by name using findMatchingPlugin
      // Create a CodeBlock compatible with the new system
      const codeBlock: CodeBlock = {
        language: block.language,
        value: block.value,
        meta: block.meta,
      };

      // Find matching plugin
      const plugin = findMatchingPlugin(plugins, codeBlock);

      if (!plugin || plugin.name !== pluginName) {
        // Fallback: find by name directly
        const directMatch = plugins.find((p) => p.name === pluginName);
        if (!directMatch) {
          this.error(
            `Plugin "${pluginName}" not found. Available plugins: ${plugins
              .map((p) => p.name)
              .join(", ")}`
          );
          return null;
        }
      }

      const matchedPlugin = plugin?.name === pluginName ? plugin : plugins.find((p) => p.name === pluginName)!;

      // Parse block parameters
      const blockParams = parseBlockParameters(block.meta);

      // Build context
      const context: TransformContext = {
        orgFilePath,
        blockIndex: actualBlockIndex,
        blockName: block.name, // Pass block name from #+NAME: directive
        parameters: blockParams,
        plugins,
        config: options.config || {},
        cacheDir: options.config?.cacheDir || "node_modules/.org-press-cache",
        base: options.config?.base || "/",
        contentDir: options.config?.contentDir || "content",
        outDir: options.config?.outDir || "dist/static",
      };

      // Determine which hook to call
      // Note: onServer is for SSR execution (handled by dev-server/build), not for browser requests
      // Virtual module loads are always for client-side, so use transform first
      try {
        let code: string;

        if (options.command === "build" && matchedPlugin.onGenerate) {
          // Build mode - use onGenerate
          const result = await matchedPlugin.onGenerate(codeBlock, context);
          code = result.code;
        } else if (matchedPlugin.transform) {
          // Client/browser mode - use transform
          const result = await matchedPlugin.transform(codeBlock, context);
          code = result.code;
        } else if (matchedPlugin.onServer) {
          // Fallback to onServer only if no transform (not recommended)
          const result = await matchedPlugin.onServer(codeBlock, context);
          code = result.code;
        } else {
          this.error(
            `Plugin "${pluginName}" has no transform hooks (onGenerate, transform, or onServer)`
          );
          return null;
        }

        // Transpile TypeScript/TSX/JSX for client-side
        // Note: Vite doesn't automatically transpile virtual modules based on extension
        // so we need to do it manually here
        const needsTranspilation = ["ts", "tsx", "jsx"].includes(extension);
        if (needsTranspilation) {
          const loader = extension as "ts" | "tsx" | "jsx";
          code = await transformTypeScript(code, loader);
        }

        // Cache and return
        blockCache.set(cacheKey, code);

        return {
          code,
        };
      } catch (error: any) {
        this.error(
          `Error transforming block with plugin "${pluginName}": ${error.message}`
        );
        return null;
      }
    },

    // Handle HMR for org file changes
    async handleHotUpdate({ file, server, timestamp }) {
      if (file.endsWith(".org")) {
        // Clear caches for this file
        astCache.delete(file);

        // Get relative path for matching cache keys
        const relativeFile = path.relative(process.cwd(), file);

        // Invalidate all virtual modules from this file
        const keysToDelete: string[] = [];
        blockCache.forEach((value, key) => {
          if (
            key.includes(":" + file + ":") ||
            key.includes(":" + relativeFile + ":") ||
            (key.includes(":" + file) && key.split(":").length === 2) ||
            (key.includes(":" + relativeFile) && key.split(":").length === 2)
          ) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach((key) => blockCache.delete(key));

        // Invalidate server result cache for this file
        const { invalidateServerResultCache } = await import("../../cache.ts");
        await invalidateServerResultCache(relativeFile);

        // Clear cross-file layout cache for this file
        const { clearCrossFileCache } = await import("../../render/cross-file-layout.ts");
        clearCrossFileCache(file);

        // Trigger HMR for affected virtual modules
        const modules = Array.from(server.moduleGraph.urlToModuleMap.entries())
          .filter(
            ([url]) =>
              url.includes(`virtual:org-press:block:`) &&
              url.includes(relativeFile)
          )
          .map(([, module]) => module);

        // Invalidate each module in the module graph
        modules.forEach((mod) => {
          server.moduleGraph.invalidateModule(mod);
        });

        return modules;
      }
    },
  };
}
