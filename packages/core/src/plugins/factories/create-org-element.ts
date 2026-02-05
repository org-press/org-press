/**
 * CreateOrgElement - Generic org-mode AST element handler factory
 *
 * For handling any org-mode AST element type. Use more specific factories
 * (CreateDrawer, CreateBlock) when possible for better type safety and
 * convenience.
 *
 * @example
 * ```typescript
 * // Remove PROPERTIES drawers
 * const hideProperties = CreateOrgElement('drawer', {
 *   match: (node) => node.name === 'PROPERTIES',
 *   transform: () => null,  // Remove from output
 * });
 *
 * // Custom link handling
 * const customLinks = CreateOrgElement('link', {
 *   match: (node) => node.linkType === 'custom',
 *   transform: (node) => `<a href="/custom/${node.path}">${node.description}</a>`,
 * });
 *
 * // Transform all tables
 * const fancyTables = CreateOrgElement('table', {
 *   transform: (node) => `<div class="table-wrapper">${renderTable(node)}</div>`,
 * });
 * ```
 */

import type {
  OrgPressPlugin,
  TransformContext,
  ElementHandler,
} from "../types.ts";

/**
 * Options for CreateOrgElement factory
 */
export interface OrgElementOptions<T = unknown> {
  /**
   * Optional filter to match specific nodes
   * Return true to handle this element, false to skip
   *
   * @param node - The AST node
   * @returns true if this plugin should handle the node
   */
  match?: (node: T) => boolean;

  /**
   * Transform the element to HTML
   *
   * @param node - The AST node
   * @param ctx - Transform context with file path and config
   * @returns HTML string, null to remove, or undefined to pass through
   */
  transform: (
    node: T,
    ctx: TransformContext
  ) => string | null | undefined | Promise<string | null | undefined>;

  /**
   * Plugin priority (higher = runs first)
   * Default: 0
   */
  priority?: number;
}

/**
 * Create a generic org-mode element handler plugin
 *
 * @param type - AST element type to handle (e.g., 'drawer', 'link', 'table')
 * @param options - Element options with optional matcher and transform
 * @returns OrgPressPlugin
 */
export function CreateOrgElement<T = unknown>(
  type: string,
  options: OrgElementOptions<T>
): OrgPressPlugin {
  const { match, transform, priority } = options;

  return {
    name: `element:${type}`,
    priority,
    _type: "element",
    _config: {
      elementType: type,
      match,
      transform,
    },

    // Setup function to register with PluginContext
    setup(ctx) {
      const handler: ElementHandler = {
        match: match as ((node: unknown) => boolean) | undefined,
        transform: transform as (
          node: unknown,
          ctx: TransformContext
        ) => string | null | undefined,
      };

      ctx.onElement(type, handler);
    },
  };
}

export default CreateOrgElement;
