# org-press

Static site generator for org-mode files — like VitePress for org.

## Features

- **Org-mode native** — Write content in org-mode, render to HTML
- **Vite-powered** — Fast dev server with HMR
- **Code execution** — Run code blocks at build time with `:use server`
- **Plugin system** — Extend with custom block handlers
- **Literate programming** — Code and documentation in one file

## Installation

```bash
npm install org-press
# or
pnpm add org-press
```

## Quick Start

1. Create a config file:

```typescript
// .org-press/config.ts
import type { OrgPressUserConfig } from "org-press";

export default {
  contentDir: "content",
  outDir: "dist/static",
} satisfies OrgPressUserConfig;
```

2. Create content:

```org
#+TITLE: Hello World

* Welcome

This is my first org-press page.

#+begin_src js :use server
const date = new Date().toLocaleDateString();
export default `<p>Generated on ${date}</p>`;
#+end_src
```

3. Run dev server:

```bash
npx orgp dev
```

4. Build for production:

```bash
npx orgp build
```

## CLI Commands

```bash
orgp dev          # Start development server
orgp build        # Build for production
orgp serve        # Serve built output
```

## Documentation

Visit [orgp.dev](https://orgp.dev) for full documentation.

## License

GPL-2.0
