import type { BlockPlugin } from "../types.ts";
import { rewriteOrgImports, parseBlockParameters } from "../utils.ts";

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
 * Languages that can be executed in preview mode
 */
const EXECUTABLE_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
];

/**
 * Preview Plugin
 *
 * Handles blocks with :use preview (or default when no :use specified).
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
 * #+begin_src javascript :use preview
 * 1 + 1
 * #+end_src
 */
/**
 * CSS-like languages that keep their extension
 */
const CSS_LANGUAGES = ["css", "scss", "sass", "less"];

export const previewPlugin: BlockPlugin = {
  name: "preview",
  // defaultExtension is 'js' because most transformed output is JavaScript
  // CSS blocks are handled specially and don't go through normal caching
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use preview
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "preview";
  },

  /**
   * Transform code for preview execution
   */
  async transform(block, context) {
    const language = block.language.toLowerCase();

    // For executable languages, transform and wrap for execution
    if (EXECUTABLE_LANGUAGES.includes(language)) {
      // Rewrite .org imports
      let code = rewriteOrgImports(block.value, context.orgFilePath);

      // Check if code already uses ES module syntax
      const hasModuleSyntax = usesModuleSyntax(code);

      if (!hasModuleSyntax) {
        // Transform last expression to return statement so the value is captured
        code = transformLastExpressionToReturn(code);
        // Wrap code in async IIFE for execution
        code = `export default (async () => {\n${code}\n})();`;
      }

      return { code };
    }

    // For CSS, just return the code (will be injected as styles)
    if (["css", "scss", "sass", "less"].includes(language)) {
      return { code: block.value };
    }

    // For other languages, return as string
    return {
      code: `export default ${JSON.stringify(block.value)};`,
    };
  },
};
