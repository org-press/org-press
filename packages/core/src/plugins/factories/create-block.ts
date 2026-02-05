/**
 * CreateBlock - Factory for code block handlers
 *
 * Code blocks are `#+begin_src language ... #+end_src` elements.
 * This factory creates plugins that transform specific language blocks.
 *
 * @example
 * ```typescript
 * // Simple transform
 * const htmlBlock = CreateBlock('html', {
 *   transform: (code) => ({ html: code }),
 * });
 *
 * // With wrapper component and client script
 * const jscadBlock = CreateBlock('jscad', {
 *   transform: (code, ctx) => ({
 *     html: `<div id="${ctx.blockId}" class="jscad-viewer"></div>`,
 *     script: generateJscadScript(code, ctx.blockId),
 *   }),
 *   wrapper: JscadViewer,
 *   defaultExtension: 'js',
 * });
 *
 * // Multiple languages
 * const jsBlock = CreateBlock(['javascript', 'js', 'typescript', 'ts'], {
 *   transform: (code, ctx) => {
 *     return { code: transpile(code) };
 *   },
 * });
 * ```
 */

import type {
  OrgPressPlugin,
  CodeBlockNode,
  BlockTransformContext,
  TransformResult,
} from "../types.ts";

/**
 * Context provided to block transform function
 */
export interface BlockContext {
  /** Unique block ID for DOM targeting */
  blockId: string;

  /** Block language */
  language: string;

  /** Parsed block parameters */
  params: Record<string, string>;

  /** Relative path to the org file */
  orgFilePath: string;

  /** Block index in file */
  blockIndex: number;

  /** Base URL path */
  base: string;

  /** Build command: 'build' for production build, 'serve' for dev server */
  command?: "build" | "serve";
}

/**
 * Options for CreateBlock factory
 */
export interface BlockOptions {
  /**
   * Transform function for the code block
   *
   * @param code - Source code from the block
   * @param ctx - Block context with ID, language, params, etc.
   * @returns Transform result with code, html, script, or css
   */
  transform: (
    code: string,
    ctx: BlockContext
  ) => TransformResult | Promise<TransformResult>;

  /**
   * Optional matcher function for blocks
   * If provided, only blocks that match will be transformed.
   * Useful for mode plugins that match on :use parameter.
   *
   * @param block - The code block node
   * @param ctx - Block context
   * @returns true if this plugin should handle the block
   */
  matches?: (block: CodeBlockNode, ctx: BlockContext) => boolean;

  /**
   * Optional React wrapper component
   * Will be used to wrap the block output
   */
  wrapper?: unknown;

  /**
   * Optional client-side script
   * Injected after the block HTML
   */
  clientScript?: string;

  /**
   * Default file extension for generated modules
   * Used by Vite for proper transpilation (js, ts, tsx, etc.)
   */
  defaultExtension?: string;

  /**
   * Plugin priority (higher = runs first)
   * Default: 0
   */
  priority?: number;
}

/**
 * Create a code block plugin
 *
 * @param language - Language name(s) to handle
 * @param options - Block options with transform function
 * @returns OrgPressPlugin
 */
export function CreateBlock(
  language: string | string[],
  options: BlockOptions
): OrgPressPlugin {
  const languages = Array.isArray(language) ? language : [language];
  const { transform, matches, wrapper, clientScript, defaultExtension, priority } = options;

  const pluginName = Array.isArray(language)
    ? `block:${languages.join(",")}`
    : `block:${language}`;

  return {
    name: pluginName,
    priority,
    _type: "block",
    _config: {
      languages,
      transform,
      matches,
      wrapper,
      clientScript,
      defaultExtension,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      ctx.onBlock(languages, async (block, blockCtx) => {
        // Create simplified BlockContext from BlockTransformContext
        const simpleCtx: BlockContext = {
          blockId: `block-${blockCtx.blockIndex}`,
          language: block.language,
          params: blockCtx.parameters,
          orgFilePath: blockCtx.orgFilePath,
          blockIndex: blockCtx.blockIndex,
          base: blockCtx.base,
          command: blockCtx.command,
        };

        // If matches function is provided, check if this block should be handled
        if (matches && !matches(block, simpleCtx)) {
          // Return undefined to signal this plugin should not handle this block
          return { code: block.value };
        }

        // Call the user's transform function
        const result = await transform(block.value, simpleCtx);

        // Inject client script if provided
        if (clientScript && result.html) {
          result.script = result.script
            ? `${result.script}\n${clientScript}`
            : clientScript;
        }

        return result;
      });
    },
  };
}

/**
 * Helper to check if a block matches a list of languages
 *
 * @param block - Code block node to check
 * @param languages - List of language names
 * @returns true if block language matches any in the list
 */
export function matchesLanguage(
  block: CodeBlockNode,
  languages: string[]
): boolean {
  return languages.includes(block.language);
}

export default CreateBlock;
