import type { BlockPlugin } from "../types.ts";
import { rewriteOrgImports } from "../utils.ts";

/**
 * Check if code uses ES module syntax (export/import)
 */
function usesModuleSyntax(code: string): boolean {
  if (/\bexport\s+(default|const|let|var|function|class|async)\b/.test(code)) {
    return true;
  }
  if (/\bexport\s*\{/.test(code)) {
    return true;
  }
  if (/^import\s+/m.test(code)) {
    return true;
  }
  return false;
}

/**
 * Built-in JavaScript plugin
 *
 * Handles JavaScript code blocks when no explicit :use mode is specified.
 * Only handles transpilation and import rewriting.
 *
 * Mode handling (preview, sourceOnly, etc.) is done by dedicated mode plugins.
 *
 * Note: TypeScript, TSX, and JSX are handled by their own dedicated plugins.
 * This plugin only handles pure JavaScript.
 */
export const javascriptPlugin: BlockPlugin = {
  name: "javascript",
  defaultExtension: "js",
  languages: ["javascript", "js"],
  priority: 10,

  /**
   * Transform JavaScript code
   *
   * This is a fallback when no mode plugin matches.
   * Default behavior: execute code and return result (like preview mode).
   */
  async transform(block, context) {
    // Rewrite .org imports to .html
    let code = rewriteOrgImports(block.value, context.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(code);

    // Default behavior: execute the code (like preview mode)
    if (!hasModuleSyntax) {
      // Wrap code in IIFE for execution
      code = `export default (async () => {\n${code}\n})();`;
    }

    return { code };
  },
};

/**
 * Alternative: Direct execution plugin (no wrapper)
 *
 * Simpler version that just returns the code for execution.
 * Useful for blocks that don't need result display.
 */
export const javascriptDirectPlugin: BlockPlugin = {
  name: "javascript-direct",
  defaultExtension: "js",
  languages: [], // Not auto-matched, must use :use javascript-direct
  priority: 5,

  async transform(block, context) {
    // Just rewrite imports and return
    const code = rewriteOrgImports(block.value, context.orgFilePath);

    return {
      code,
    };
  },
};
