/**
 * Built-in JavaScript Plugin
 *
 * Handles JavaScript code blocks when no explicit :use mode is specified.
 * Only handles transpilation and import rewriting.
 *
 * Mode handling (preview, sourceOnly, etc.) is done by dedicated mode plugins.
 *
 * Note: TypeScript, TSX, and JSX are handled by their own dedicated plugins.
 * This plugin only handles pure JavaScript.
 */

import { CreateBlock } from "../index.ts";
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
 * JavaScript plugin using CreateBlock factory
 *
 * Priority: 10 (built-in plugins have medium priority)
 * Languages: javascript, js
 */
export const javascriptPlugin = CreateBlock(["javascript", "js"], {
  transform: (code, ctx) => {
    // Rewrite .org imports to .html
    let transformedCode = rewriteOrgImports(code, ctx.orgFilePath);

    // Check if code already uses ES module syntax
    const hasModuleSyntax = usesModuleSyntax(transformedCode);

    // Default behavior: execute the code (like preview mode)
    if (!hasModuleSyntax) {
      // Wrap code in IIFE for execution
      transformedCode = `export default (async () => {\n${transformedCode}\n})();`;
    }

    return { code: transformedCode };
  },
  defaultExtension: "js",
  priority: 10,
});

// Override the plugin name and expose v1 properties for backward compatibility
javascriptPlugin.name = "javascript";
(javascriptPlugin as any).defaultExtension = "js";
(javascriptPlugin as any).languages = ["javascript", "js"];
// Wrap transform to v1 signature: (block, context) => result
(javascriptPlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (javascriptPlugin as any)._config?.transform;
  if (!configTransform) return { code: block.value };
  const simpleCtx = {
    blockId: `block-${ctx.blockIndex || 0}`,
    language: block.language,
    params: ctx.parameters || {},
    orgFilePath: ctx.orgFilePath || "",
    blockIndex: ctx.blockIndex || 0,
    base: ctx.base || "/",
  };
  return configTransform(block.value, simpleCtx);
};

/**
 * Alternative: Direct execution plugin (no wrapper)
 *
 * Simpler version that just returns the code for execution.
 * Useful for blocks that don't need result display.
 */
export const javascriptDirectPlugin = CreateBlock([], {
  transform: (code, ctx) => {
    // Just rewrite imports and return
    const transformedCode = rewriteOrgImports(code, ctx.orgFilePath);
    return { code: transformedCode };
  },
  defaultExtension: "js",
  priority: 5,
});

// Override the plugin name and expose v1 properties for backward compatibility
javascriptDirectPlugin.name = "javascript-direct";
(javascriptDirectPlugin as any).defaultExtension = "js";
(javascriptDirectPlugin as any).languages = [];
// Wrap transform to v1 signature
(javascriptDirectPlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (javascriptDirectPlugin as any)._config?.transform;
  if (!configTransform) return { code: block.value };
  const simpleCtx = {
    blockId: `block-${ctx.blockIndex || 0}`,
    language: block.language,
    params: ctx.parameters || {},
    orgFilePath: ctx.orgFilePath || "",
    blockIndex: ctx.blockIndex || 0,
    base: ctx.base || "/",
  };
  return configTransform(block.value, simpleCtx);
};
