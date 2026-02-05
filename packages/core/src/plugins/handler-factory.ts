/**
 * Server Handler Factory
 *
 * Provides factory functions for creating server handlers with
 * automatic error handling, timeout, and execution time tracking.
 */

import type {
  ServerHandler,
  ServerExecutionResult,
  CodeBlock,
  ServerHandlerContext,
  ServerClientContext,
} from "./types.ts";

/**
 * Factory for creating server handlers with automatic error handling and timeout
 *
 * Wraps user-provided handlers with:
 * - Execution timeout (default: 30 seconds)
 * - Error catching and formatting
 * - Execution time tracking
 *
 * @param matcher - Function to determine if handler should process the block
 * @param config - Handler configuration with onServer, onClient, and options
 * @returns Server handler instance
 *
 * @example
 * ```typescript
 * const jsHandler = createServerHandler(
 *   (params, block) => params.use === 'server' && block.language === 'javascript',
 *   {
 *     async onServer(code, context) {
 *       // Execute code
 *       return result;
 *     },
 *     onClient(result, context) {
 *       // Generate display code
 *       return `document.getElementById('${context.blockId}-result').textContent = ...`;
 *     },
 *     options: { timeout: 30000 }
 *   }
 * );
 * ```
 */
export function createServerHandler(
  matcher: (params: Record<string, string>, block: CodeBlock) => boolean,
  config: {
    onServer: (code: string, context: ServerHandlerContext) => Promise<any>;
    onClient?: (result: any, context: ServerClientContext) => string;
    options?: {
      timeout?: number;
      [key: string]: any;
    };
  }
): ServerHandler {
  return {
    matches: matcher,
    options: config.options,

    async onServer(code, context): Promise<ServerExecutionResult> {
      const startTime = Date.now();
      const timeout = config.options?.timeout || 30000;

      try {
        const result = await Promise.race([
          config.onServer(code, context),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Execution timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        return {
          result,
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          result: null,
          error: error instanceof Error ? error : new Error(String(error)),
          executionTime: Date.now() - startTime,
        };
      }
    },

    onClient: config.onClient,
  };
}
