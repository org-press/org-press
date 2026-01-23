# Org-Press

Literate computing in plain text. Write prose and code together. Everything executes.

Org-press is a static site generator built for literate programming. Write in org syntax and transform your documents into interactive websites with executable code blocks, live previews, and literate testing.

> **Note:** This project was built with AI assistance. [Read more about it.](#was-this-built-with-ai)

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#faq">FAQ</a>
</p>

---

## Features

- **Executable Code Blocks** - JavaScript, TypeScript, TSX, CSS blocks run in the browser
- **Server-Side Execution** - Run code at build time with `:use server`
- **Literate Testing** - Write tests alongside documentation with `orgp test`
- **Code Quality Tools** - Format, lint, and type-check code blocks
- **Block Plugins** - Extend with custom visualizations (Excalidraw, JSCad, etc.)
- **Hot Module Replacement** - Instant feedback during development
- **Cross-File Imports** - Import blocks between org files
- **LSP Support** - Language server for editor integration (currently Emacs lsp-mode)

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
| `@org-press/block-excalidraw` | Excalidraw diagram block plugin |
| `@org-press/block-jscad` | JSCad 3D modeling block plugin |

---

## Usage

### CLI Commands

```bash
orgp dev          # Start development server
orgp build        # Build static site
orgp test         # Run literate tests
orgp fmt          # Format code blocks with Prettier
orgp lint         # Lint code blocks with ESLint
orgp type-check   # Type-check TypeScript blocks
orgp lsp          # Start language server
```

### Executable Code Blocks

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

### Literate Testing

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

### Code Quality Tools

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

### LSP Support

Org-press includes a language server for editor integration. Currently supported:

- **Emacs** with [lsp-mode](https://emacs-lsp.github.io/lsp-mode/)

Start the language server:

```bash
orgp lsp
```

Configure in Emacs:

```elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration '(org-mode . "org"))
  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection '("npx" "orgp" "lsp"))
    :activation-fn (lsp-activate-on "org")
    :server-id 'org-press-lsp)))
```

The LSP provides:
- Diagnostics from lint, type-check, and test results
- Go-to-definition for cross-file block imports
- Hover information for block references

---

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

### Vite Integration

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

### Block Plugins

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

---

## FAQ

### Is this org-mode?

**No.** Org-press uses org syntax (sometimes called "org-down") but is not org-mode. We chose the org format for its expressive block syntax, not to replicate Emacs org-mode functionality.

**What we share:** The file format. Org syntax provides named blocks, header arguments, and structured markup that's perfect for literate programming. Your `.org` files are valid org syntax and will render in any org-mode viewer.

**What's different:** Everything else. Org-mode is a powerful Emacs application with agendas, TODO management, time tracking, spreadsheets, and a vast ecosystem built over decades. Org-press is a web-focused static site generator. We rebuild specific features (like code execution and tangling) from scratch, targeting the browser instead of Emacs.

Think of it like Markdown: many tools use Markdown syntax, but they're not all the same application. Similarly, org-press uses org syntax while being its own tool optimized for web publishing and literate programming.

### Why org syntax instead of Markdown?

**Markdown's syntax has fundamental limitations for literate programming.** We could implement the same features in Markdown, but we'd have to invent non-standard syntax extensions that wouldn't work with any other tool:

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

**Org syntax has this built in:**

```org
#+NAME: add-func
#+begin_src typescript :use preview | withSourceCode
export function add(a, b) { return a + b; }
#+end_src
```

The syntax for named blocks and header arguments (`:use`, `:tangle`, etc.) is part of the org specification. We leverage existing, documented syntax rather than inventing conventions.

**Note on cross-block references:** Emacs org-mode uses noweb syntax (`<<block-name>>`) for referencing other blocks. We chose ES module imports instead:

```typescript
import { add } from './math.org?name=add-func';
```

This approach provides better IDE support - you get autocomplete, go-to-definition, and type checking across block boundaries. Standard tooling (TypeScript, ESLint) understands imports; they don't understand noweb references.

**Trying something new can be rewarding.** Markdown tools are everywhere - and they're great. But if you've ever wished your documentation could *run*, or wanted to test code examples inline, org-press offers something different. Give it a try.

### Can I use Markdown for README files?

Yes! Use the `:tangle` parameter to generate Markdown files from your org source:

```org
#+begin_src markdown :tangle README.md
# My Package

This README is generated from the org source.
#+end_src
```

This keeps your source of truth in org while producing the Markdown files that package registries expect.

### Is org-press only for Emacs users?

No. Org-press is not Emacs org-mode - it's a standalone tool that uses org syntax. You don't need Emacs at all. Org files are plain text with a simple, readable syntax that you can edit in any text editor:

- **VS Code**: [org-mode extension](https://marketplace.visualstudio.com/items?itemName=vscode-org-mode.org-mode) for syntax highlighting
- **Vim/Neovim**: [orgmode.nvim](https://github.com/nvim-orgmode/orgmode)
- **Any text editor**: Org syntax is human-readable plain text

### How does this compare to Jupyter notebooks?

Both support literate programming. Jupyter is an industry standard and excels at interactive data exploration. Org-press takes a different approach:

**Plain text, standard tooling.** Org files are plain text - you get real version control diffs, not JSON blobs. Your existing tools (ESLint, Prettier, TypeScript) work out of the box. No special notebook environment required.

**Editor-native experience.** Because it's plain text with standard imports, you get full IDE support: intellisense, go-to-definition, refactoring across blocks. The editing experience is your normal code editor, not a browser-based notebook.

**Open format.** Org syntax is a documented, open specification that's been around since 2003. Your content isn't locked into any particular tool or platform.

### Was this built with AI?

**Yes, and I'm proud of it.**

This project went through multiple prototypes over the last 10 years that I never managed to complete and publish. Parsing org blocks, building an LSP, getting Vite integration right - these problems kept stopping me. AI brought back the fun of building it.

Is this AI slop? Probably, I don't know. I spent days going through each file, creating review lists, refactoring across versions, and cleaning the architecture. I didn't type every line or write every loop, but I shaped the architecture, defined the behavior, and wrote the specs. Is it perfect? No. Is it production ready? No.

I built it because it was fun. I built it for me. You're welcome to use it, with the hope it unleashes your creativity like it did for mine.

I believe literate programming has great potential when paired with AI - prose and code together create rich context that AI assistants understand well. This project is both a tool for that workflow and a product of it.

### Can I contribute?

**Contributions are welcome**, but org-press is currently open source without open development. The code is publicly available under GPL-2.0, and you're free to use, fork, and modify it. Development happens in a private repository and is synced to GitHub.

We're happy to receive bug reports and feature suggestions via issues. Pull requests may take longer to review as open development isn't our current priority, but we appreciate them nonetheless.

As the project matures, we expect to move toward a more open development model.

---

## Documentation

See the [docs](./docs) folder or visit the documentation site.

## License

GPL-2.0 - Code should be free.
