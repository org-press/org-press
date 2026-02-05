/**
 * @org-press/deploy-cloudflare
 *
 * Cloudflare Pages deploy adapter for org-press.
 *
 * Deploys static sites to Cloudflare Pages using the wrangler CLI.
 *
 * @example
 * ```typescript
 * import { cloudflareAdapter } from '@org-press/deploy-cloudflare';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: cloudflareAdapter({
 *       project: 'my-site',
 *       branch: 'preview',
 *     }),
 *   },
 * });
 * ```
 */

// Types
export type { CloudflareConfig } from "./types.ts";

// Adapter
export { CloudflareAdapter, cloudflareAdapter } from "./adapter.ts";
