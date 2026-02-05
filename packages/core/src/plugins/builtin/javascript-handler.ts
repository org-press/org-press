/**
 * Default JavaScript Handler for Server Execution
 *
 * Provides a pre-configured handler for executing JavaScript/TypeScript
 * code blocks on the server with the `:use server` parameter.
 *
 * All code is executed as ES modules using dynamic import.
 */

import { createServerHandler } from "../handler-factory.ts";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { CodeBlock } from "../types.ts";

/**
 * Check if code uses ES module syntax (export/import)
 */
function usesModuleSyntax(code: string): boolean {
  // Check for export statements
  if (/\bexport\s+(default|const|let|var|function|class|async)\b/.test(code)) {
    return true;
  }
  // Check for import statements (not dynamic imports)
  if (/^import\s+/m.test(code)) {
    return true;
  }
  return false;
}

/**
 * Convert legacy code with return statements to ES module format
 *
 * Wraps code in an async IIFE and exports the result as default.
 */
function convertToModuleFormat(code: string): string {
  // If code already uses module syntax, return as-is
  if (usesModuleSyntax(code)) {
    return code;
  }

  // Wrap in async IIFE and export the result
  // This handles code with return statements
  return `
const __result = await (async () => {
${code}
})();

export default __result;
`;
}

/**
 * Execute code as an ES module using dynamic import
 *
 * Writes code to a temporary file and imports it as a module.
 * This properly supports ES module syntax (import/export).
 *
 * @param code - Code to execute (will be converted to module format if needed)
 * @param contentHelpers - Content helpers to inject
 * @returns The default export or module exports
 */
async function executeAsModule(
  code: string,
  contentHelpers: any
): Promise<any> {
  // Create temp directory for server execution
  const tempDir = join(process.cwd(), ".org-press-cache", "server-exec");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // Generate unique filename
  // Remove dashes from UUID to make valid JS identifier
  const moduleId = randomUUID().replace(/-/g, "");
  const tempFile = join(tempDir, `${moduleId}.mjs`);

  // Convert to module format if needed
  const moduleCode = convertToModuleFormat(code);

  // Inject content helpers as a global-like variable
  // We wrap the code to provide access to `content` variable
  const wrappedCode = `
// Injected content helpers
const content = globalThis.__orgpress_content_${moduleId};

${moduleCode}
`;

  try {
    // Write module to temp file
    writeFileSync(tempFile, wrappedCode, "utf-8");

    // Set content helpers on globalThis for the module to access
    const globalKey = `__orgpress_content_${moduleId}`;
    (globalThis as any)[globalKey] = contentHelpers;

    // Import and execute the module
    const moduleUrl = `file://${tempFile}`;
    const module = await import(moduleUrl);

    // Clean up global
    delete (globalThis as any)[globalKey];

    // Return default export if available, otherwise the whole module
    return module.default !== undefined ? module.default : module;
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Default JavaScript/TypeScript handler for server execution
 *
 * All code is executed as ES modules. Legacy code with return
 * statements is automatically converted to module format.
 *
 * Matches blocks with:
 * - `:use server` parameter
 * - Language: javascript, js, typescript, ts, jsx, tsx
 *
 * @param options - Configuration options
 * @returns Server handler for JavaScript
 *
 * @example
 * ```typescript
 * import { createServerPlugin, createDefaultJavaScriptHandler } from 'org-press';
 *
 * const serverPlugin = createServerPlugin([
 *   createDefaultJavaScriptHandler({ timeout: 30000 })
 * ]);
 * ```
 */
export function createDefaultJavaScriptHandler(options?: {
  /** Execution timeout in milliseconds (default: 30000) */
  timeout?: number;
}) {
  const { timeout = 30000 } = options || {};

  return createServerHandler(
    // Matcher: :use server with JavaScript/TypeScript languages
    (params: Record<string, string>, block: CodeBlock) => {
      return (
        params.use === "server" &&
        ["javascript", "js", "typescript", "ts", "jsx", "tsx"].includes(
          block.language
        )
      );
    },
    // Handler config
    {
      async onServer(code, context) {
        // Execute code as ES module
        return await executeAsModule(code, context.contentHelpers);
      },

      onClient(result, context) {
        return generateDisplayCode(result, context.blockId);
      },

      options: { timeout },
    }
  );
}

/**
 * Generate display code based on result type
 */
function generateDisplayCode(result: any, blockId: string): string {
  if (result === undefined || result === null) {
    return `// No result to display`;
  }

  if (isReactElement(result)) {
    // React element - render with ReactDOM
    return `
      import('react-dom/client').then(({ default: ReactDOM }) => {
        const container = document.getElementById('${blockId}-result');
        if (container) {
          const root = ReactDOM.createRoot(container);
          root.render(${serializeReactElement(result)});
        }
      }).catch(err => {
        console.error('Failed to render React element:', err);
        const container = document.getElementById('${blockId}-result');
        if (container) {
          container.innerHTML = '<pre class="error">React rendering not available</pre>';
        }
      });
    `;
  }

  if (typeof result === "object") {
    // JSON - prettified viewer
    return `
      const container = document.getElementById('${blockId}-result');
      if (container) {
        container.innerHTML = '<pre>' +
          JSON.stringify(${JSON.stringify(result)}, null, 2) +
          '</pre>';
      }
    `;
  }

  // Primitive - text display
  return `
    const container = document.getElementById('${blockId}-result');
    if (container) {
      container.textContent = ${JSON.stringify(String(result))};
    }
  `;
}

/**
 * Check if value is a React element
 */
function isReactElement(value: any): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const reactElementSymbol = Symbol.for("react.element");
  const reactTransitionalElementSymbol = Symbol.for(
    "react.transitional.element"
  );
  return (
    value.$$typeof === reactElementSymbol ||
    value.$$typeof === reactTransitionalElementSymbol
  );
}

/**
 * Serialize React element for client-side hydration
 * Currently not fully implemented - throws error
 */
function serializeReactElement(element: any): string {
  // For now, we can't properly serialize React elements
  // The server-side rendering path should be used instead
  throw new Error(
    "React element serialization not yet supported. Use server-side rendering."
  );
}
