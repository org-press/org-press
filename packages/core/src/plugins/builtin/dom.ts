import type { BlockPlugin } from "../types.ts";
import { rewriteOrgImports, parseBlockParameters } from "../utils.ts";

/**
 * Default render function code
 *
 * This function renders block execution results to the DOM.
 * Blocks can override this by exporting their own `render` function.
 *
 * @param result - The execution result from the block's default export
 * @param el - The DOM element to render into
 */
const DEFAULT_RENDER_CODE = `
function render(result, el) {
  // Skip null/undefined
  if (result === null || result === undefined) return;
  // Handle function exports (render function that takes container ID)
  if (typeof result === "function") {
    result(el.id);
  }
  // Handle HTMLElement exports
  else if (result instanceof HTMLElement) {
    if (!el.hasChildNodes()) el.appendChild(result);
  }
  // Handle string exports (could be HTML or plain text)
  else if (typeof result === "string") {
    if (result.trim().startsWith("<")) {
      el.innerHTML = result;
    } else {
      el.textContent = result;
    }
  }
  // Handle numbers and booleans
  else if (typeof result === "number" || typeof result === "boolean") {
    el.textContent = String(result);
  }
  // Handle objects/arrays (display as formatted JSON)
  else if (typeof result === "object") {
    el.innerHTML = "<pre>" + JSON.stringify(result, null, 2) + "</pre>";
  }
}
export { render };
`.trim();

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
 * Transform code to return the last expression value
 *
 * If the last non-empty line is an expression statement (not a declaration,
 * return, if/for/while, etc.), prepend 'return' to make it the return value.
 *
 * This enables simple code like:
 *   const x = 42;
 *   x;
 * To work as expected (returning 42).
 */
function transformLastExpressionToReturn(code: string): string {
  const lines = code.split("\n");

  // Find the last non-empty, non-comment line
  let lastLineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
      lastLineIndex = i;
      break;
    }
  }

  if (lastLineIndex === -1) {
    return code;
  }

  const lastLine = lines[lastLineIndex].trim();

  // Skip if it's already a return statement
  if (lastLine.startsWith("return ") || lastLine === "return") {
    return code;
  }

  // Skip if it's a declaration (const, let, var, function, class, etc.)
  if (/^(const|let|var|function|class|async\s+function|interface|type|enum)\s/.test(lastLine)) {
    return code;
  }

  // Skip if it's a control flow statement
  if (/^(if|else|for|while|do|switch|try|catch|finally|throw)\b/.test(lastLine)) {
    return code;
  }

  // Skip if it's a block closing brace
  if (lastLine === "}" || lastLine === "};") {
    return code;
  }

  // Skip if it's an assignment (but not comparison)
  // Match: x = ..., x += ..., etc. but not x == ... or x === ...
  if (/^[a-zA-Z_$][\w$]*\s*[+\-*/%]?=(?!=)/.test(lastLine)) {
    return code;
  }

  // Otherwise, it's likely an expression statement - add return
  // Handle the case where the line ends with a semicolon
  const lineWithoutSemicolon = lastLine.replace(/;$/, "");
  lines[lastLineIndex] = lines[lastLineIndex].replace(
    lastLine,
    `return ${lineWithoutSemicolon};`
  );

  return lines.join("\n");
}

/**
 * Languages that can be executed in dom mode
 */
const EXECUTABLE_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
];

/**
 * DOM Plugin
 *
 * Handles blocks with :use dom (or default when no :use specified).
 * Executes code and displays the result.
 *
 * For JavaScript/TypeScript:
 * - Rewrites .org imports
 * - Wraps code in async IIFE for execution
 * - Returns the result via export default
 *
 * For CSS:
 * - Delegates to CSS handling (inject styles)
 *
 * Usage:
 * #+begin_src javascript :use dom
 * 1 + 1
 * #+end_src
 */
/**
 * CSS-like languages that keep their extension
 */
const CSS_LANGUAGES = ["css", "scss", "sass", "less"];

export const domPlugin: BlockPlugin = {
  name: "dom",
  // defaultExtension is 'js' because most transformed output is JavaScript
  // CSS blocks are handled specially and don't go through normal caching
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use dom
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "dom";
  },

  /**
   * Transform code for DOM execution
   *
   * Output format:
   * - `default` export: The execution result (data, component, etc.)
   * - `render` export: The render function `(result, el) => void`
   *
   * For code without custom render, the default render is added.
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    // For executable languages, transform and wrap for execution
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let code = rewriteOrgImports(block.value, context.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(code);

      // Check if code already exports a render function
      const hasRenderExport = /export\s+(?:const|function|{[^}]*render[^}]*})/.test(code) &&
                              /\brender\b/.test(code);

      if (!hasModuleSyntax) {
        // Transform last expression to return statement so the value is captured
        code = transformLastExpressionToReturn(code);
        // Wrap code in async IIFE for execution
        code = `export default (async () => {\n${code}\n})();`;
      }

      // Add default render export if not already present
      if (!hasRenderExport) {
        code = `${code}\n\n${DEFAULT_RENDER_CODE}`;
      }

      return { code };
    }

    // For CSS, just return the code (will be injected as styles)
    if (["css", "scss", "sass", "less"].includes(language)) {
      return { code: block.value };
    }

    // For other languages, return as string with default render
    return {
      code: `export default ${JSON.stringify(block.value)};\n\n${DEFAULT_RENDER_CODE}`,
    };
  },
};
