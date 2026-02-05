/**
 * Cloudflare Pages Adapter Types
 *
 * Configuration types for the Cloudflare Pages deploy adapter.
 */

/**
 * Cloudflare Pages adapter configuration options
 *
 * @example
 * ```typescript
 * const config: CloudflareConfig = {
 *   project: 'my-site',
 *   accountId: '1234567890abcdef',
 *   branch: 'main',
 *   commitMessage: 'Deploy from org-press',
 * };
 * ```
 */
export interface CloudflareConfig {
  /**
   * Cloudflare Pages project name (required)
   * This is the project name as it appears in the Cloudflare dashboard
   */
  project: string;

  /**
   * Cloudflare account ID
   * If not specified, reads from CF_ACCOUNT_ID environment variable
   */
  accountId?: string;

  /**
   * Branch name for branch deployments (preview deployments)
   * If not specified, deploys to production
   */
  branch?: string;

  /**
   * Deployment commit message
   * Shown in the Cloudflare dashboard
   */
  commitMessage?: string;
}
