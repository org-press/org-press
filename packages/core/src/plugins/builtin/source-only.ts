/**
 * Source-only mode plugin
 *
 * Intercepts `:use sourceOnly` blocks and renders syntax-highlighted code
 * without executing any transforms. Uses CreateBlock with a matches function
 * to check the :use parameter.
 *
 * Usage:
 * #+begin_src javascript :use sourceOnly
 * // This code is displayed but not executed
 * console.log("Hello");
 * #+end_src
 */

import { CreateBlock } from "../index.ts";

/**
 * Languages that this plugin can handle
 * (essentially all common languages that might use sourceOnly mode)
 */
const ALL_LANGUAGES = [
  "javascript", "js",
  "typescript", "ts",
  "tsx", "jsx",
  "css", "scss", "sass", "less",
  "html", "xml",
  "python", "py",
  "ruby", "rb",
  "go", "rust", "c", "cpp", "java",
  "json", "yaml", "yml", "toml",
  "markdown", "md",
  "shell", "bash", "sh", "zsh",
  "sql", "graphql",
  "text", "plaintext",
];

/**
 * Source-only plugin using CreateBlock factory
 *
 * Priority: 50 (mode plugins have higher priority than language plugins)
 */
export const sourceOnlyPlugin = CreateBlock(ALL_LANGUAGES, {
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use sourceOnly
   */
  matches: (_block, ctx) => {
    const useValue = ctx.params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "sourceOnly";
  },

  /**
   * Transform code for display only (no execution)
   */
  transform: (code, _ctx) => {
    // Return code as a string export - it won't be executed
    // The rendering layer will display it as source code
    return {
      code: `// Source display only (not executed)\nexport default ${JSON.stringify(code)};`,
    };
  },

  defaultExtension: "js",
});

// Override the plugin name for clarity
sourceOnlyPlugin.name = "sourceOnly";

// Expose v1-compatible properties for backward compatibility
(sourceOnlyPlugin as any).defaultExtension = "js";
(sourceOnlyPlugin as any).languages = ALL_LANGUAGES;

// v1-compatible matches function
(sourceOnlyPlugin as any).matches = (block: { meta?: string | null }) => {
  if (!block.meta) return false;
  const useMatch = block.meta.match(/:use\s+((?:[^:]|:(?!\w))+?)(?=\s*:\w|$)/);
  if (!useMatch) return false;
  const useValue = useMatch[1].trim();
  const firstPart = useValue.split("|")[0].trim();
  return firstPart === "sourceOnly";
};

// v1-compatible transform function
(sourceOnlyPlugin as any).transform = async (
  block: { value: string; language: string; meta?: string | null },
  _ctx: any
) => {
  return {
    code: `// Source display only (not executed)\nexport default ${JSON.stringify(block.value)};`,
  };
};
