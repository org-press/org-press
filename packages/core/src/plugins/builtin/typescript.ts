/**
 * Built-in TypeScript Plugin
 *
 * Handles TypeScript code blocks when no explicit :use mode is specified.
 * Only handles transpilation and import rewriting.
 *
 * Mode handling (preview, sourceOnly, etc.) is done by dedicated mode plugins.
 *
 * Key insight: Using defaultExtension: "ts" tells Vite to transpile the code
 * automatically using its built-in esbuild integration.
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
 * TypeScript plugin using CreateBlock factory
 *
 * Priority: 10 (built-in plugins have medium priority)
 * Languages: typescript, ts
 */
export const typescriptPlugin = CreateBlock(["typescript", "ts"], {
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
  defaultExtension: "ts",
  priority: 10,
});

// Override the plugin name and expose v1 properties for backward compatibility
typescriptPlugin.name = "typescript";
(typescriptPlugin as any).defaultExtension = "ts";
(typescriptPlugin as any).languages = ["typescript", "ts"];
// Wrap transform to v1 signature: (block, context) => result
(typescriptPlugin as any).transform = async (block: { value: string; language: string; meta?: string }, ctx: any) => {
  const configTransform = (typescriptPlugin as any)._config?.transform;
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
