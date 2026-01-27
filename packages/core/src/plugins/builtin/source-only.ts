import type { BlockPlugin } from "../types.ts";
import { parseBlockParameters } from "../utils.ts";

/**
 * Source Only Plugin
 *
 * Handles blocks with :use sourceOnly.
 * Displays code without executing it.
 *
 * Usage:
 * #+begin_src javascript :use sourceOnly
 * // This code is displayed but not executed
 * console.log("Hello");
 * #+end_src
 */
export const sourceOnlyPlugin: BlockPlugin = {
  name: "sourceOnly",
  defaultExtension: "js",
  priority: 50, // Higher than language plugins (10)

  /**
   * Match blocks with :use sourceOnly
   */
  matches(block) {
    const params = parseBlockParameters(block.meta);
    const useValue = params.use || "";
    const firstPart = useValue.split("|")[0].trim();
    return firstPart === "sourceOnly";
  },

  /**
   * Transform code for display only (no execution)
   */
  async transform(block, context) {
    // Return code as a string export - it won't be executed
    // The rendering layer will display it as source code
    return {
      code: `// Source display only (not executed)\nexport default ${JSON.stringify(block.value)};`,
    };
  },
};
