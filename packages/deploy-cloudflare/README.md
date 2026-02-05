# @org-press/deploy-cloudflare

Cloudflare Pages deploy adapter for [org-press](https://orgp.dev).

Deploys static sites to Cloudflare Pages using the wrangler CLI.

## Installation

```bash
npm install @org-press/deploy-cloudflare
# or
pnpm add @org-press/deploy-cloudflare
```

You also need wrangler installed:

```bash
npm install -D wrangler
```

## Usage

### Basic Usage

```typescript
import { cloudflareAdapter } from '@org-press/deploy-cloudflare';

export default defineConfig({
  deploy: {
    adapter: cloudflareAdapter({
      project: 'my-site',
    }),
  },
});
```

### Branch Deployments (Previews)

```typescript
import { cloudflareAdapter } from '@org-press/deploy-cloudflare';

export default defineConfig({
  deploy: {
    adapter: cloudflareAdapter({
      project: 'my-site',
      branch: 'preview',
    }),
  },
});
```

### Full Configuration

```typescript
import { cloudflareAdapter } from '@org-press/deploy-cloudflare';

export default defineConfig({
  deploy: {
    adapter: cloudflareAdapter({
      // Cloudflare Pages project name (required)
      project: 'my-site',

      // Cloudflare account ID (optional, uses CF_ACCOUNT_ID env var if not set)
      accountId: '1234567890abcdef',

      // Branch for preview deployments (optional)
      // If not specified, deploys to production
      branch: 'preview',

      // Deployment commit message (optional)
      commitMessage: 'Deploy from CI',
    }),
  },
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | `string` | **required** | Cloudflare Pages project name |
| `accountId` | `string` | From `CF_ACCOUNT_ID` | Cloudflare account ID |
| `branch` | `string` | - | Branch for preview deployments |
| `commitMessage` | `string` | `'Deploy from org-press'` | Deployment message shown in dashboard |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for authentication |
| `CF_API_TOKEN` | Alternative API token variable |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

## How It Works

The adapter deploys your site using the wrangler CLI:

1. Validates wrangler is available
2. Runs `wrangler pages deploy <outDir> --project-name <project>`
3. Parses the deployment URL from wrangler output
4. Returns the deployment result with URL

## Deployment URLs

Cloudflare Pages provides different URLs based on deployment type:

- **Production**: `https://<project>.pages.dev`
- **Branch/Preview**: `https://<branch>.<project>.pages.dev`
- **Custom Domain**: Configure in Cloudflare dashboard

## Dry Run Mode

Test your deployment configuration without actually deploying:

```typescript
const result = await deploy({
  adapter: cloudflareAdapter({ project: 'my-site' }),
  dryRun: true,
});

console.log(result.url); // Predicted Cloudflare Pages URL
```

## Authentication

Wrangler handles authentication in several ways:

1. **API Token** (recommended): Set `CLOUDFLARE_API_TOKEN` environment variable
2. **OAuth**: Run `wrangler login` to authenticate interactively
3. **Cached credentials**: Wrangler caches credentials after login

### Creating an API Token

1. Go to Cloudflare Dashboard > My Profile > API Tokens
2. Create a token with "Cloudflare Pages: Edit" permission
3. Set the token as `CLOUDFLARE_API_TOKEN` environment variable

## CI/CD Examples

### GitHub Actions

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
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

      - name: Deploy to Cloudflare Pages
        run: pnpm deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

### Preview Deployments on PR

```yaml
name: Preview Deployment

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
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

      - name: Deploy Preview
        run: pnpm deploy --branch pr-${{ github.event.number }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

## Requirements

- Node.js 18+
- wrangler CLI (installed as dev dependency)
- Cloudflare account with Pages enabled
- API token or interactive login

## Troubleshooting

### "wrangler is not available"

Install wrangler as a dev dependency:

```bash
npm install -D wrangler
```

### "Authentication failed"

Ensure your API token has the correct permissions:
- Cloudflare Pages: Edit
- Account: Read (if using account ID auto-detection)

### "Project not found"

The project must exist in your Cloudflare Pages dashboard before deployment. Create it via:
- Cloudflare dashboard
- `wrangler pages project create <name>`

## License

GPL-2.0
