# @org-press/deploy-github-pages

GitHub Pages deploy adapter for [org-press](https://orgp.dev).

Deploys static sites to GitHub Pages by pushing to the `gh-pages` branch.

## Installation

```bash
npm install @org-press/deploy-github-pages
# or
pnpm add @org-press/deploy-github-pages
```

## Usage

### Basic Usage

```typescript
import { githubPagesAdapter } from '@org-press/deploy-github-pages';

export default defineConfig({
  deploy: {
    adapter: githubPagesAdapter({
      repo: 'user/my-site',
    }),
  },
});
```

### With Custom Domain

```typescript
import { githubPagesAdapter } from '@org-press/deploy-github-pages';

export default defineConfig({
  deploy: {
    adapter: githubPagesAdapter({
      repo: 'user/my-site',
      cname: 'mysite.com',
    }),
  },
});
```

### Full Configuration

```typescript
import { githubPagesAdapter } from '@org-press/deploy-github-pages';

export default defineConfig({
  deploy: {
    adapter: githubPagesAdapter({
      // GitHub repository (user/repo or org/repo format)
      // If not specified, auto-detects from git remote
      repo: 'user/my-site',

      // Target branch (default: 'gh-pages')
      branch: 'gh-pages',

      // Custom domain for CNAME file
      cname: 'mysite.com',

      // Add .nojekyll file (default: true)
      // Recommended for pre-built static sites
      noJekyll: true,

      // Commit message (default: 'Deploy to GitHub Pages')
      message: 'Deploy docs from CI',

      // Remote name (default: 'origin')
      remote: 'origin',
    }),
  },
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repo` | `string` | Auto-detected | GitHub repository in `user/repo` format |
| `branch` | `string` | `'gh-pages'` | Target branch for deployment |
| `cname` | `string` | - | Custom domain (creates CNAME file) |
| `noJekyll` | `boolean` | `true` | Add `.nojekyll` file to disable Jekyll |
| `message` | `string` | `'Deploy to GitHub Pages'` | Git commit message |
| `remote` | `string` | `'origin'` | Git remote name |

## How It Works

The adapter deploys your site by:

1. Adding a `.nojekyll` file (optional, recommended)
2. Adding a `CNAME` file if a custom domain is configured
3. Initializing a new git repository in your build output directory
4. Committing all files
5. Force pushing to the `gh-pages` branch on GitHub

This approach ensures a clean deployment each time without accumulating history.

## Auto-Detection

If `repo` is not specified, the adapter attempts to auto-detect the repository from your git remote:

```bash
# Supports both HTTPS and SSH remote URLs:
https://github.com/user/repo.git
git@github.com:user/repo.git
```

## Dry Run Mode

Test your deployment without actually pushing:

```typescript
const result = await deploy({
  adapter: githubPagesAdapter({ repo: 'user/repo' }),
  dryRun: true,
});

console.log(result.url); // Predicted GitHub Pages URL
```

## GitHub Pages URL

The adapter returns the correct URL based on your repository:

- **User/Org pages** (`username.github.io`): `https://username.github.io`
- **Project pages** (`user/project`): `https://user.github.io/project`
- **Custom domain**: `https://your-domain.com`

## Requirements

- Git must be installed and available in PATH
- Push access to the target repository
- For private repos, appropriate authentication (SSH key or token)

## CI/CD Example

### GitHub Actions

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm build

      - name: Deploy
        run: pnpm deploy
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## License

GPL-2.0
