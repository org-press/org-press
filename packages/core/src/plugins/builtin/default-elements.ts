/**
 * Default Element Plugins for org-press
 *
 * Handles common org-mode drawers with consistent styling.
 * Uses CreateDrawer factory.
 *
 * Drawer types:
 * - Callouts: NOTE, INFO, TIP, WARNING, IMPORTANT, CAUTION, EXAMPLE
 * - Quotes: QUOTE
 *
 * @example
 * ```org
 * :NOTE:
 * This is an important note.
 * :END:
 *
 * :TIP:
 * Here's a helpful tip!
 * :END:
 *
 * :WARNING:
 * Be careful with this operation.
 * :END:
 *
 * :QUOTE:
 * "The only way to do great work is to love what you do." - Steve Jobs
 * :END:
 * ```
 */

import { CreateDrawer } from "../index.ts";

/**
 * Get icon for drawer type (using Unicode symbols)
 */
function getDrawerIcon(type: string): string {
  const icons: Record<string, string> = {
    note: "&#x1F4DD;",     // memo
    info: "&#x2139;&#xFE0F;", // information source
    tip: "&#x1F4A1;",      // light bulb
    warning: "&#x26A0;&#xFE0F;", // warning sign
    important: "&#x2757;", // exclamation mark
    caution: "&#x1F6A8;",  // police car light (alarm)
    example: "&#x1F4CB;",  // clipboard
  };
  return icons[type] || "&#x1F4CC;"; // pushpin as default
}

/**
 * Standard callout drawer types
 *
 * Handles: NOTE, INFO, TIP, WARNING, IMPORTANT, CAUTION, EXAMPLE
 *
 * Output HTML:
 * ```html
 * <aside class="org-callout org-callout--note" role="note">
 *   <div class="org-callout__icon">&#x1F4DD;</div>
 *   <div class="org-callout__content">
 *     <div class="org-callout__title">NOTE</div>
 *     <p>Content here...</p>
 *   </div>
 * </aside>
 * ```
 */
export const calloutDrawerPlugin = CreateDrawer(
  ["NOTE", "INFO", "TIP", "WARNING", "IMPORTANT", "CAUTION", "EXAMPLE"],
  (drawer) => {
    const type = drawer.name.toLowerCase();
    const icon = getDrawerIcon(type);
    return `<aside class="org-callout org-callout--${type}" role="note">
  <div class="org-callout__icon">${icon}</div>
  <div class="org-callout__content">
    <div class="org-callout__title">${drawer.name}</div>
    ${drawer.html}
  </div>
</aside>`;
  }
);

/**
 * Quote drawer - for blockquotes
 *
 * Output HTML:
 * ```html
 * <blockquote class="org-quote">
 *   <p>Quote content here...</p>
 * </blockquote>
 * ```
 */
export const quoteDrawerPlugin = CreateDrawer("QUOTE", (drawer) =>
  `<blockquote class="org-quote">${drawer.html}</blockquote>`
);

