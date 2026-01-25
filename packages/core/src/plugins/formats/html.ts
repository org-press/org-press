/**
 * HTML Format Wrapper
 *
 * Passes through HTML result directly or wraps it in a container.
 */

import type { RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface HtmlFormatConfig {
  /** CSS class for the container (if wrap=true) */
  className?: string;

  /** Whether to wrap in a container div (default: false) */
  wrap?: boolean;

  /** Sanitize HTML to prevent XSS (default: false for server blocks) */
  sanitize?: boolean;
}

/**
 * HTML format wrapper factory
 *
 * Passes through HTML result directly.
 * Use this for server blocks that return HTML content.
 *
 * @example
 * ```org
 * #+begin_src javascript :use server | html
 * return `<div class="custom">
 *   <h2>Generated Content</h2>
 *   <p>This HTML is passed through directly.</p>
 * </div>`;
 * #+end_src
 * ```
 *
 * @example
 * // Wrap in container
 * :use server | html?wrap&className=content
 */
export const htmlFormat = (config?: Record<string, unknown>) => {
  const {
    className = "org-html",
    wrap = false,
    sanitize = false,
  } = (config ?? {}) as HtmlFormatConfig;

  return (_inputRender: RenderFunction): RenderFunction => {
    return (result: unknown, _ctx: BlockContext): RenderResult => {
      // Handle null/undefined
      if (result === null || result === undefined) {
        return null;
      }

      // Convert to string
      let html = String(result);

      // Basic sanitization if requested
      if (sanitize) {
        html = sanitizeHtml(html);
      }

      // Wrap in container if requested
      if (wrap) {
        return `<div class="${className}">${html}</div>`;
      }

      return html;
    };
  };
};

/**
 * Basic HTML sanitization
 *
 * Removes script tags and event handlers.
 * This is a basic implementation - for production use,
 * consider a library like DOMPurify.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove on* event handlers
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    // Remove javascript: URLs
    .replace(/href\s*=\s*["']?javascript:[^"'\s>]*/gi, 'href="#"')
    .replace(/src\s*=\s*["']?javascript:[^"'\s>]*/gi, 'src=""');
}
