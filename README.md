# Org-Press

Static site generator for org-mode files - like VitePress for org.

Transform your org-mode documents into interactive websites with executable code blocks, live previews, and literate testing.

## Features

- **Executable Code Blocks** - JavaScript, TypeScript, TSX, CSS blocks run in the browser
- **Server-Side Execution** - Run code at build time with `:use server`
- **Literate Testing** - Write tests alongside documentation with `orgp test`
- **Code Quality Tools** - Format, lint, and type-check code blocks
- **Block Plugins** - Extend with custom visualizations (Excalidraw, JSCad, etc.)
- **Hot Module Replacement** - Instant feedback during development
- **Cross-File Imports** - Import blocks between org files

## Quick Start

```bash
# Install
npm install org-press

# Create content/index.org
mkdir content
echo "#+TITLE: Hello World" > content/index.org

# Start dev server
npx orgp dev
```

## Packages

| Package | Description |
|---------|-------------|
| `org-press` | Core library with Vite plugin, parser, and CLI |
| `@org-press/block-test` | Literate testing with Vitest |
| `@org-press/tools` | Format, lint, and type-check code blocks |
| `@org-press/mcp` | MCP server for AI assistant integration |
| `@org-press/block-excalidraw` | Excalidraw diagram block plugin |
| `@org-press/block-jscad` | JSCad 3D modeling block plugin |

## CLI Commands

```bash
orgp dev          # Start development server
orgp build        # Build static site
orgp test         # Run literate tests
orgp fmt          # Format code blocks with Prettier
orgp lint         # Lint code blocks with ESLint
orgp type-check   # Type-check TypeScript blocks
```

## Executable Code Blocks

Code blocks in org files are automatically executed and their results displayed:

```org
#+begin_src typescript
const greeting = "Hello from TypeScript!";
export default <div>{greeting}</div>;
#+end_src
```

### Display Modes

Control what's displayed with `:use`:

```org
#+begin_src javascript :use preview | withSourceCode
// Shows both code and result
export default <button>Click me</button>;
#+end_src

#+begin_src javascript :use preview
// Shows only the result (default)
export default <span>Just the output</span>;
#+end_src

#+begin_src javascript :use sourceOnly
// Shows only the code (no execution)
console.log("Documentation only");
#+end_src

#+begin_src javascript :use silent
// Executes but shows nothing
window.myGlobal = "initialized";
#+end_src
```

### Server-Side Execution

Run code at build time for data fetching, file processing, etc:

```org
#+begin_src typescript :use server
const data = await fetch('https://api.example.com/data').then(r => r.json());
return <ul>{data.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
#+end_src
```

## Literate Testing

Write tests alongside your documentation:

```bash
npm install @org-press/block-test vitest
```

```org
#+NAME: math-utils
#+begin_src typescript
export function add(a: number, b: number): number {
  return a + b;
}
#+end_src

#+begin_src typescript :use test
import { describe, it, expect } from 'vitest';
import { add } from './math-utils';

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
#+end_src
```

```bash
orgp test              # Run all tests
orgp test --watch      # Watch mode
orgp test math.org     # Run tests in specific file
```

## Code Quality Tools

```bash
npm install @org-press/tools
```

```typescript
// .org-press/config.ts
import { fmtPlugin, lintPlugin, typeCheckPlugin } from '@org-press/tools';

export default {
  contentDir: 'content',
  plugins: [fmtPlugin, lintPlugin, typeCheckPlugin],
};
```

```bash
orgp fmt --check       # Check formatting
orgp fmt               # Format all blocks
orgp lint              # Lint JS/TS blocks
orgp lint --fix        # Auto-fix lint issues
orgp type-check        # Type-check TypeScript
```

## AI Integration (MCP)

Enable AI assistants to understand and work with your org-press project:

```bash
npm install @org-press/mcp
```

Add to your `mcp.json`:

```json
{
  "mcpServers": {
    "org-press": {
      "command": "npx",
      "args": ["org-press-mcp"]
    }
  }
}
```

The MCP server exposes:
- **Tools**: Run tests, format, lint, type-check, and build
- **Resources**: Browse code blocks, view diagnostics, access project config

## Configuration

```typescript
// .org-press/config.ts
import { defineConfig } from 'org-press';

export default defineConfig({
  contentDir: 'content',
  outDir: 'dist',
  base: '/',
  plugins: [],
});
```

## Vite Integration

```typescript
// vite.config.ts
import { orgPress } from 'org-press/vite';

export default {
  plugins: [await orgPress()]
};
```

Import org files directly in your app:

```typescript
import { html, metadata, blocks } from './content/post.org';

console.log(metadata.title);  // Document title
console.log(html);            // Rendered HTML
console.log(blocks);          // Code block exports
```

## Block Plugins

Create custom block handlers:

```typescript
import type { BlockPlugin } from 'org-press';

const myPlugin: BlockPlugin = {
  name: 'my-plugin',
  languages: ['mylang'],

  async transform(block, context) {
    return {
      code: `export default ${JSON.stringify(block.value)};`
    };
  }
};
```

## Philosophy

Org-press positions org files as the **optimal specification format for the AI era** through literate programming:

- **Humans**: Rich documentation with natural language
- **Machines**: Executable code blocks
- **AI Assistants**: Structured context for understanding and generation

## FAQ

### Why org-mode instead of Markdown?

**Markdown's syntax has fundamental limitations for literate programming.** We could implement the same features in Markdown, but we'd have to invent non-standard syntax extensions:

```markdown
<!-- Markdown: no native way to name blocks or add parameters -->
```ts
export function add(a, b) { return a + b; }
```

<!-- You'd need to invent something like: -->
```ts {name: "add-func", exports: "both", tangle: "math.ts"}
...
```
```

This invented syntax would:
- Not work with any other Markdown tool
- Need to be documented and learned separately
- Feel bolted-on rather than native

**Org-mode has this built into the specification:**

```org
#+NAME: add-func
#+begin_src typescript :use preview | withSourceCode
export function add(a, b) { return a + b; }
#+end_src
```

The syntax for named blocks and header arguments (`:use`, `:tangle`, etc.) is part of org-mode's design. We leverage existing, documented syntax rather than inventing conventions.

**Note on cross-block references:** Traditional org-mode uses noweb syntax (`<<block-name>>`) for referencing other blocks. We chose ES module imports instead:

```typescript
import { add } from './math.org?name=add-func';
```

This approach provides better IDE support - you get autocomplete, go-to-definition, and type checking across block boundaries. Standard tooling (TypeScript, ESLint) understands imports; they don't understand noweb references.

**Trying something new can be rewarding.** Markdown tools are everywhere - and they're great. But if you've ever wished your documentation could *run*, or wanted to test code examples inline, org-press offers something different. Give it a try.

### Can I use Markdown for README files?

Yes! Use org-mode's `:tangle` parameter to generate Markdown files from your org source:

```org
#+begin_src markdown :tangle README.md
# My Package

This README is generated from the org source.
#+end_src
```

This keeps your source of truth in org while producing the Markdown files that package registries expect.

### Is org-press only for Emacs users?

No. You don't need Emacs to use org-press. Org files are plain text with a simple, readable syntax. Many editors have org-mode support:

- **VS Code**: [org-mode extension](https://marketplace.visualstudio.com/items?itemName=vscode-org-mode.org-mode)
- **Vim/Neovim**: [orgmode.nvim](https://github.com/nvim-orgmode/orgmode)
- **Any text editor**: Org syntax is human-readable plain text

### How does this compare to Jupyter notebooks?

Both support literate programming. Jupyter is an industry standard and excels at interactive data exploration. Org-press takes a different approach:

**Plain text, standard tooling.** Org files are plain text - you get real version control diffs, not JSON blobs. Your existing tools (ESLint, Prettier, TypeScript) work out of the box. No special notebook environment required.

**Editor-native experience.** Because it's plain text with standard imports, you get full IDE support: intellisense, go-to-definition, refactoring across blocks. The editing experience is your normal code editor, not a browser-based notebook.

**Open format.** Org-mode is a documented, open specification that's been around since 2003. Your content isn't locked into any particular tool or platform.

### Can I contribute?

**Contributions are welcome**, but org-press is currently open source without open development. The code is publicly available under GPL-2.0, and you're free to use, fork, and modify it. Development happens in a private repository and is synced to GitHub.

We're happy to receive bug reports and feature suggestions via issues. Pull requests may take longer to review as open development isn't our current priority, but we appreciate them nonetheless.

As the project matures, we expect to move toward a more open development model.

## Documentation

See the [docs](./docs) folder or visit the documentation site.

## License

GPL-2.0 - Code should be free.
