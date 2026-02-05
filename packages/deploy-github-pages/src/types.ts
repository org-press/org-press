/**
 * GitHub Pages Adapter Types
 *
 * Configuration types for the GitHub Pages deploy adapter.
 */

/**
 * GitHub Pages adapter configuration options
 *
 * @example
 * ```typescript
 * const config: GitHubPagesConfig = {
 *   repo: 'user/my-site',
 *   branch: 'gh-pages',
 *   cname: 'mysite.com',
 *   noJekyll: true,
 *   message: 'Deploy from org-press',
 * };
 * ```
 */
export interface GitHubPagesConfig {
  /**
   * GitHub repository in format "user/repo" or "org/repo"
   * If not specified, attempts to auto-detect from git remote
   */
  repo?: string;

  /**
   * Target branch for GitHub Pages deployment
   * @default "gh-pages"
   */
  branch?: string;

  /**
   * Custom domain for GitHub Pages (creates CNAME file)
   * Set to empty string or omit to disable
   */
  cname?: string;

  /**
   * Add .nojekyll file to disable Jekyll processing
   * Recommended when deploying pre-built static sites
   * @default true
   */
  noJekyll?: boolean;

  /**
   * Commit message for the deployment
   * @default "Deploy to GitHub Pages"
   */
  message?: string;

  /**
   * Remote name to push to
   * @default "origin"
   */
  remote?: string;
}
