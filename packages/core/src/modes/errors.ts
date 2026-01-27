/**
 * Error Handling for Unhandled Blocks
 *
 * Provides helpful error messages when blocks require modes that aren't installed.
 */

/**
 * Context required for error messages
 */
export interface ErrorContext {
  blockId: string;
  language: string;
  orgFilePath: string;
}

/**
 * Suggested modes that can be installed
 */
export type SuggestedMode = 'react' | 'vue' | 'rust';

/**
 * Package names for each mode
 */
const MODE_PACKAGES: Record<string, string> = {
  react: '@org-press/react',
  vue: '@org-press/vue',
  rust: '@org-press/rust',
};

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Render an error message for unhandled blocks
 *
 * Shown in:
 * - Dev mode: In the HTML container
 * - CLI: As a warning during build
 *
 * @param ctx - Block context information
 * @param suggestedMode - The mode that should be installed
 * @returns HTML string with error message and installation instructions
 */
export function renderUnhandledError(
  ctx: ErrorContext,
  suggestedMode: SuggestedMode
): string {
  const pkg = MODE_PACKAGES[suggestedMode] || `@org-press/${suggestedMode}`;
  const modeName = capitalize(suggestedMode);

  return `
    <div class="org-press-error" style="
      padding: 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.5rem;
      color: #991b1b;
      font-family: system-ui, sans-serif;
    ">
      <strong>Block not rendered</strong>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem;">
        This block requires <code>${pkg}</code>. Add it to your config:
      </p>
      <pre style="
        margin: 0.5rem 0 0 0;
        padding: 0.5rem;
        background: #fee2e2;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        overflow-x: auto;
      ">import { use${modeName} } from '${pkg}';

export default defineConfig({
  modes: [use${modeName}()]
});</pre>
    </div>
  `.trim();
}

/**
 * Log a warning during build for unhandled blocks
 *
 * @param ctx - Block context information
 * @param suggestedMode - The mode that should be installed
 */
export function warnUnhandledBlock(
  ctx: ErrorContext,
  suggestedMode: string
): void {
  const pkg = MODE_PACKAGES[suggestedMode] || `@org-press/${suggestedMode}`;
  const modeName = capitalize(suggestedMode);

  console.warn(
    `[org-press] Block "${ctx.blockId}" in ${ctx.orgFilePath} was not rendered.\n` +
      `  → This ${ctx.language} block requires ${pkg}.\n` +
      `  → Install it and add to your config: modes: [use${modeName}()]`
  );
}
