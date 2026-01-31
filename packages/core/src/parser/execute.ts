import { createRequire } from "module";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { ServerExecutionResult } from "./types.ts";

/**
 * Server-side code execution
 *
 * Executes code blocks marked with :use server during build/SSR.
 * Provides access to content helpers for dynamic page generation.
 */

// Create require function for server block execution
const require = createRequire(import.meta.url);

// Lazy-loaded esbuild transform - prevents test environment issues
let esbuildTransform: typeof import("esbuild").transform | null = null;

async function getEsbuildTransform() {
  if (!esbuildTransform) {
    const esbuild = await import("esbuild");
    esbuildTransform = esbuild.transform;
  }
  return esbuildTransform;
}

/**
 * JavaScript/TypeScript languages supported for server execution
 */
const JS_COMPATIBLE_LANGUAGES = ["javascript", "js", "typescript", "ts", "jsx", "tsx"];

/**
 * Transform code to capture the last expression value
 *
 * If the code doesn't have an export default statement, this function
 * wraps the code to capture the last expression's result. This enables
 * simple code like:
 *   const x = 42;
 *   x;
 * To work as expected (returning 42).
 *
 * @param code - The code to transform
 * @returns Transformed code with export default for the result
 */
function transformToExportLastExpression(code: string): string {
  // Check if code already has an export default
  // Matches: export default, export { x as default }
  if (/\bexport\s+default\b/.test(code) || /\bexport\s*\{[^}]*\bdefault\b/.test(code)) {
    return code;
  }

  // Find the last non-empty, non-comment line
  const lines = code.split("\n");
  let lastLineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
      lastLineIndex = i;
      break;
    }
  }

  if (lastLineIndex === -1) {
    // No non-empty lines, wrap the whole thing
    return `const __result = await (async () => { ${code} })();\nexport default __result;`;
  }

  const lastLine = lines[lastLineIndex].trim();

  // Skip if it's already a return statement
  if (lastLine.startsWith("return ") || lastLine === "return") {
    return `const __result = await (async () => { ${code} })();\nexport default __result;`;
  }

  // Skip if it's a declaration (const, let, var, function, class, etc.)
  if (/^(const|let|var|function|class|async\s+function|interface|type|enum)\s/.test(lastLine)) {
    // Code ends with a declaration - no result to capture
    return code + "\nexport default undefined;";
  }

  // Skip if it's a control flow statement
  if (/^(if|else|for|while|do|switch|try|catch|finally|throw)\b/.test(lastLine)) {
    return `const __result = await (async () => { ${code} })();\nexport default __result;`;
  }

  // Skip if it's a block closing brace
  if (lastLine === "}" || lastLine === "};") {
    return code + "\nexport default undefined;";
  }

  // Skip if it's an assignment (but not comparison)
  if (/^[a-zA-Z_$][\w$]*\s*[+\-*/%]?=(?!=)/.test(lastLine)) {
    return code + "\nexport default undefined;";
  }

  // Check if the last line is an expression statement (ends with ; or is a function call)
  // Replace the last expression with an export default
  const lineWithoutSemicolon = lastLine.replace(/;$/, "");

  // Check if it's a standalone expression (function call, variable reference, etc.)
  // Create a new version where we capture and export the result
  const codeBeforeLastLine = lines.slice(0, lastLineIndex).join("\n");
  const lastLineIndent = lines[lastLineIndex].match(/^(\s*)/)?.[1] || "";

  return `${codeBeforeLastLine}
${lastLineIndent}const __lastResult = ${lineWithoutSemicolon};
export default __lastResult;`;
}

/**
 * Transpile TypeScript/TSX/JSX to JavaScript using lazy-loaded esbuild
 */
async function transpileCode(
  code: string,
  language: string
): Promise<string> {
  const tsLanguages = ["typescript", "ts", "tsx", "jsx"];
  if (!tsLanguages.includes(language.toLowerCase())) {
    return code;
  }

  const transform = await getEsbuildTransform();
  const loader = language.toLowerCase() === "tsx" ? "tsx"
               : language.toLowerCase() === "jsx" ? "jsx"
               : "ts";

  const result = await transform(code, {
    loader,
    target: "esnext",
    format: "esm",
  });
  return result.code;
}

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * Content helpers available to server blocks
 *
 * These functions are injected into the execution context,
 * allowing server blocks to query and manipulate content.
 */
export interface ContentHelpers {
  /**
   * Get all content pages
   * @param options - Optional filtering options
   */
  getContentPages: (options?: any) => Promise<any[]>;

  /**
   * Get content pages from specific directory
   * @param directory - Directory to filter by
   * @param options - Optional filtering options
   */
  getContentPagesFromDirectory: (
    directory: string,
    options?: any
  ) => Promise<any[]>;

  /**
   * Render a list of pages as HTML
   * @param pages - Pages to render
   */
  renderPageList: (pages: any[]) => string;

  /**
   * Check if running in development mode
   */
  isDevelopment: () => boolean;
}

/**
 * Execute JavaScript/TypeScript code on the server
 *
 * Uses dynamic import via temp files to support ES modules.
 * - `require`: Node.js require function for imports
 * - `content`: Content helper functions
 *
 * @param code - JavaScript/TypeScript code to execute
 * @param language - Programming language (for transpilation)
 * @param contentHelpers - Content helper functions
 * @returns Execution result
 *
 * @example
 * const result = await executeJavaScript(`
 *   const pages = await content.getContentPages();
 *   export default content.renderPageList(pages);
 * `, "javascript", contentHelpers);
 */
async function executeJavaScript(
  code: string,
  language: string,
  contentHelpers: ContentHelpers
): Promise<ServerExecutionResult> {
  const startTime = Date.now();

  const tempDir = join(process.cwd(), ".org-press-cache", "server-exec");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const moduleId = randomUUID().replace(/-/g, "");
  const tempFile = join(tempDir, `${moduleId}.mjs`);

  try {
    // Transpile TypeScript if needed
    const transpiledCode = await transpileCode(code, language);

    // Transform to export the last expression result if no explicit export
    const transformedCode = transformToExportLastExpression(transpiledCode);

    // Inject content helpers
    const wrappedCode = `
const content = globalThis.__orgpress_content_${moduleId};
const require = globalThis.__orgpress_require_${moduleId};

${transformedCode}
`;

    writeFileSync(tempFile, wrappedCode, "utf-8");

    const contentKey = `__orgpress_content_${moduleId}`;
    const requireKey = `__orgpress_require_${moduleId}`;
    (globalThis as any)[contentKey] = contentHelpers;
    (globalThis as any)[requireKey] = require;

    const moduleUrl = `file://${tempFile}`;
    const module = await import(moduleUrl);

    delete (globalThis as any)[contentKey];
    delete (globalThis as any)[requireKey];

    // Get the default export, or undefined if not present
    // NOTE: Don't fall back to `module` itself - ES module namespace objects
    // cannot be converted to primitives and will throw "Cannot convert object to primitive value"
    const result = module.default;
    const executionTime = Date.now() - startTime;

    // Convert result to string, handling objects gracefully
    let output: string;
    if (result === undefined || result === null) {
      output = "";
    } else if (typeof result === "object") {
      try {
        output = JSON.stringify(result, null, 2);
      } catch {
        output = "[Object cannot be serialized]";
      }
    } else {
      output = String(result);
    }

    return {
      output,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    let errorObj: Error;
    if (error instanceof Error) {
      errorObj = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorObj = new Error(String((error as any).message));
    } else {
      errorObj = new Error(String(error));
    }
    return {
      output: "",
      error: errorObj,
      executionTime,
    };
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Execute a server-side code block
 *
 * Executes code marked with :use server during build/SSR.
 * Currently only supports JavaScript/TypeScript.
 *
 * @param code - Code to execute
 * @param language - Programming language
 * @param contentHelpers - Content helper functions to inject
 * @returns Execution result
 *
 * @example
 * const result = await executeServerBlock(
 *   `
 *   const pages = await content.getContentPages();
 *   export default \`<ul>\${pages.map(p => \`<li>\${p.title}</li>\`).join('')}</ul>\`;
 *   `,
 *   "javascript",
 *   contentHelpers
 * );
 *
 * if (result.error) {
 *   console.error("Execution failed:", result.error);
 * } else {
 *   console.log("Output:", result.output);
 * }
 */
export async function executeServerBlock(
  code: string,
  language: string,
  contentHelpers: ContentHelpers
): Promise<ServerExecutionResult> {
  // Prevent execution in browser
  if (isBrowser()) {
    return {
      output: "",
      error: new Error(
        "Server execution is not supported in browser environment"
      ),
    };
  }

  const normalizedLanguage = language.toLowerCase();

  // Check if language is supported
  if (!JS_COMPATIBLE_LANGUAGES.includes(normalizedLanguage)) {
    return {
      output: "",
      error: new Error(
        `Unsupported language for server execution: ${language}. ` +
          `Supported languages: ${JS_COMPATIBLE_LANGUAGES.join(", ")}`
      ),
    };
  }

  // Execute JavaScript/TypeScript
  return executeJavaScript(code, normalizedLanguage, contentHelpers);
}

/**
 * Create content helpers for server execution
 *
 * This function should be called by the build layer to provide
 * content helper implementations.
 *
 * @param getContentPages - Implementation of getContentPages
 * @param getContentPagesFromDirectory - Implementation of getContentPagesFromDirectory
 * @param renderPageList - Implementation of renderPageList
 * @param isDevelopment - Implementation of isDevelopment
 * @returns Content helpers object
 */
export function createContentHelpers(
  getContentPages: ContentHelpers["getContentPages"],
  getContentPagesFromDirectory: ContentHelpers["getContentPagesFromDirectory"],
  renderPageList: ContentHelpers["renderPageList"],
  isDevelopment: ContentHelpers["isDevelopment"]
): ContentHelpers {
  return {
    getContentPages,
    getContentPagesFromDirectory,
    renderPageList,
    isDevelopment,
  };
}
