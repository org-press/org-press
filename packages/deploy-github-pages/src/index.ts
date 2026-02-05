/**
 * @org-press/deploy-github-pages
 *
 * GitHub Pages deploy adapter for org-press.
 *
 * Deploys static sites to GitHub Pages by pushing to the gh-pages branch.
 *
 * @example
 * ```typescript
 * import { githubPagesAdapter } from '@org-press/deploy-github-pages';
 *
 * export default defineConfig({
 *   deploy: {
 *     adapter: githubPagesAdapter({
 *       repo: 'user/my-site',
 *       cname: 'mysite.com',
 *     }),
 *   },
 * });
 * ```
 */

// Types
export type { GitHubPagesConfig } from "./types.ts";

// Adapter
export { GitHubPagesAdapter, githubPagesAdapter } from "./adapter.ts";
