# Quickstart Example

This example demonstrates the minimal setup for org-press, matching the README quickstart guide.

## Running the Example

1. Install dependencies from the monorepo root:

   ```bash
   cd ../..
   pnpm install
   pnpm build
   ```

2. Start the dev server:

   ```bash
   cd examples/quickstart
   pnpm dev
   ```

3. Open http://localhost:5173 in your browser.

## What's Included

- `content/index.org` - A simple org file with a title and an executable JavaScript block
- `package.json` - Minimal configuration with dev and build scripts

## Building for Production

```bash
pnpm build
```

This generates a static site in the `dist/` directory.
