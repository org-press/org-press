/**
 * Build a single org file to various output formats
 *
 * Supports three modes:
 * - static: Pre-renders to HTML + assets (default)
 * - middleware: Creates a self-contained serverless function
 * - server: Creates a server entry point
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { extractMetadata } from "../../parser/metadata.ts";
import { parseBlockParameters } from "../../plugins/utils.ts";

/**
 * Extract the full :use value from parameters string, including pipe syntax
 * The pipe syntax (e.g., "preview | withSourceCode") is specific to :use
 */
function extractUseValue(params: string | null | undefined): string {
  if (!params) return "";

  // Match :use followed by everything until :key or end of string
  // This captures the full pipe-separated value
  const match = params.match(/:use\s+([^:]+)/);
  if (match) {
    return match[1].trim();
  }
  return "";
}

/**
 * Server block execution result
 */
interface ServerBlockResult {
  nodeId: string;
  output: string;
  error?: string;
}

/**
 * Execute a server block's JavaScript/TypeScript code
 * Returns the output as a string
 */
async function executeServerBlock(code: string, language: string): Promise<string> {
  const tempDir = path.join(process.cwd(), ".org-press-cache", "build-single-exec");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const moduleId = randomUUID().replace(/-/g, "");
  const tempFile = path.join(tempDir, `${moduleId}.mjs`);

  try {
    // Write the code directly - it should use ES module syntax
    fs.writeFileSync(tempFile, code, "utf-8");

    const moduleUrl = `file://${tempFile}`;
    const module = await import(moduleUrl);

    // Get the default export
    const result = module.default;

    // Convert result to string
    if (result === undefined || result === null) {
      return "";
    } else if (typeof result === "object") {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return "[Object cannot be serialized]";
      }
    } else {
      return String(result);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `<span class="org-error">Error: ${escapeHtml(errorMsg)}</span>`;
  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Build mode determines output format
 */
export type BuildMode = "static" | "middleware" | "server";

/**
 * Options for building a single org file
 */
export interface BuildSingleOptions {
  /** Path to the org file */
  file: string;
  /** Output directory */
  outDir?: string;
  /** Build mode */
  mode?: BuildMode;
  /** Base path for assets */
  base?: string;
  /** Minify output */
  minify?: boolean;
  /** Generate source maps */
  sourcemap?: boolean;
}

/**
 * Result of building a single file
 */
export interface BuildSingleResult {
  /** Output directory path */
  outDir: string;
  /** List of generated files */
  files: string[];
  /** Build mode used */
  mode: BuildMode;
  /** Build duration in ms */
  duration: number;
}

/**
 * Parse arguments for the build command
 */
export function parseBuildArgs(args: string[]): BuildSingleOptions {
  const options: BuildSingleOptions = {
    file: "",
    mode: "static",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--mode" || arg === "-m") {
      const mode = args[++i] as BuildMode;
      if (!["static", "middleware", "server"].includes(mode)) {
        throw new Error(`Invalid mode: ${mode}. Must be static, middleware, or server.`);
      }
      options.mode = mode;
      i++;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const mode = arg.slice("--mode=".length) as BuildMode;
      if (!["static", "middleware", "server"].includes(mode)) {
        throw new Error(`Invalid mode: ${mode}. Must be static, middleware, or server.`);
      }
      options.mode = mode;
      i++;
      continue;
    }

    if (arg === "--out-dir" || arg === "-o") {
      options.outDir = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length);
      i++;
      continue;
    }

    if (arg === "--base" || arg === "-b") {
      options.base = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--base=")) {
      options.base = arg.slice("--base=".length);
      i++;
      continue;
    }

    if (arg === "--minify") {
      options.minify = true;
      i++;
      continue;
    }

    if (arg === "--sourcemap") {
      options.sourcemap = true;
      i++;
      continue;
    }

    // Skip flags we don't recognize (they might be for upstream)
    if (arg.startsWith("-")) {
      i++;
      continue;
    }

    // Positional argument - ignore (file is already set from hashbang context)
    i++;
  }

  return options;
}

/**
 * Build a single org file
 */
export async function buildSingleFile(
  file: string,
  options: Omit<BuildSingleOptions, "file"> = {}
): Promise<BuildSingleResult> {
  const startTime = Date.now();
  const mode = options.mode || "static";

  // Resolve file path
  const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Determine output directory
  const fileName = path.basename(file, ".org");
  const outDir = options.outDir || path.resolve(process.cwd(), `dist-${fileName}`);

  console.log(`[build] Building ${file} in ${mode} mode...`);
  console.log(`[build] Output: ${outDir}`);

  // Clean and create output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Read and parse the org file
  const source = fs.readFileSync(filePath, "utf-8");
  const cleanSource = source.startsWith("#!") ? source.replace(/^#!.*\n/, "") : source;
  const ast = parse(cleanSource) as OrgData;
  const metadata = extractMetadata(ast);

  const files: string[] = [];

  switch (mode) {
    case "static":
      await buildStatic(filePath, ast, metadata, outDir, options, files);
      break;

    case "middleware":
      await buildMiddleware(filePath, ast, metadata, outDir, options, files);
      break;

    case "server":
      await buildServer(filePath, ast, metadata, outDir, options, files);
      break;
  }

  const duration = Date.now() - startTime;
  console.log(`[build] Complete in ${duration}ms`);
  console.log(`[build] Files: ${files.join(", ")}`);

  return {
    outDir,
    files,
    mode,
    duration,
  };
}

/**
 * Build static HTML output
 */
async function buildStatic(
  filePath: string,
  ast: OrgData,
  metadata: Record<string, any>,
  outDir: string,
  options: Omit<BuildSingleOptions, "file">,
  files: string[]
): Promise<void> {
  // For static build, we render the org file to HTML
  const title = metadata.title || path.basename(filePath, ".org");
  const base = options.base || "/";

  // Extract content and code blocks for rendering
  const { html, styles, scripts } = await renderOrgToHtml(ast, metadata);

  // Generate the HTML document
  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <base href="${base}">
  ${styles.map((s) => `<style>${s}</style>`).join("\n  ")}
</head>
<body>
  <article class="org-content">
    ${html}
  </article>
  ${scripts.map((s) => `<script type="module">${s}</script>`).join("\n  ")}
</body>
</html>`;

  // Write the HTML file
  const htmlPath = path.join(outDir, "index.html");
  fs.writeFileSync(htmlPath, htmlDoc);
  files.push("index.html");

  console.log(`[build:static] Generated index.html`);
}

/**
 * Build middleware handler output
 */
async function buildMiddleware(
  filePath: string,
  ast: OrgData,
  metadata: Record<string, any>,
  outDir: string,
  options: Omit<BuildSingleOptions, "file">,
  files: string[]
): Promise<void> {
  const title = metadata.title || path.basename(filePath, ".org");

  // Extract API blocks
  const apiBlocks = extractApiBlocks(ast);

  // Generate the handler
  const handlerCode = `
/**
 * Generated middleware handler for ${title}
 * Source: ${path.basename(filePath)}
 */

// API route handlers
const apiHandlers = new Map();
${apiBlocks
  .map(
    (block, i) => `
apiHandlers.set('${block.route}', {
  method: '${block.method}',
  handler: async (request, env, ctx) => {
    ${block.code}
  }
});`
  )
  .join("\n")}

// Pre-rendered HTML content
const htmlContent = ${JSON.stringify(await renderOrgToHtmlString(ast, metadata))};

/**
 * Request handler
 */
export default async function handler(request, env, ctx) {
  const url = new URL(request.url);

  // Check for API routes
  for (const [route, config] of apiHandlers) {
    if (url.pathname === route && request.method === config.method) {
      return config.handler(request, env, ctx);
    }
  }

  // Return the rendered page
  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Export metadata for tooling
export const manifest = {
  title: ${JSON.stringify(title)},
  api: ${JSON.stringify(apiBlocks.map((b) => ({ route: b.route, method: b.method })))},
};
`;

  const handlerPath = path.join(outDir, "handler.js");
  fs.writeFileSync(handlerPath, handlerCode);
  files.push("handler.js");

  // Generate manifest
  const manifest = {
    source: path.basename(filePath),
    title,
    api: apiBlocks.map((b) => ({ route: b.route, method: b.method })),
    mode: "middleware",
  };

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  files.push("manifest.json");

  console.log(`[build:middleware] Generated handler.js and manifest.json`);
}

/**
 * Build server entry point output
 */
async function buildServer(
  filePath: string,
  ast: OrgData,
  metadata: Record<string, any>,
  outDir: string,
  options: Omit<BuildSingleOptions, "file">,
  files: string[]
): Promise<void> {
  const title = metadata.title || path.basename(filePath, ".org");

  // Extract API blocks
  const apiBlocks = extractApiBlocks(ast);

  // Generate server code
  const serverCode = `
/**
 * Generated server for ${title}
 * Source: ${path.basename(filePath)}
 */

import { createServer } from 'node:http';

// API route handlers
const apiHandlers = new Map();
${apiBlocks
  .map(
    (block, i) => `
apiHandlers.set('${block.route}', {
  method: '${block.method}',
  handler: async (req, res) => {
    try {
      ${block.code}
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});`
  )
  .join("\n")}

// Pre-rendered HTML content
const htmlContent = ${JSON.stringify(await renderOrgToHtmlString(ast, metadata))};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);

  // Check for API routes
  for (const [route, config] of apiHandlers) {
    if (url.pathname === route && req.method === config.method) {
      res.setHeader('Content-Type', 'application/json');
      return config.handler(req, res);
    }
  }

  // Return the rendered page
  res.setHeader('Content-Type', 'text/html');
  res.end(htmlContent);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});

export { server };
`;

  const serverPath = path.join(outDir, "server.js");
  fs.writeFileSync(serverPath, serverCode);
  files.push("server.js");

  // Generate package.json for the server
  const packageJson = {
    name: title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    version: "1.0.0",
    type: "module",
    main: "server.js",
    scripts: {
      start: "node server.js",
    },
  };

  const packagePath = path.join(outDir, "package.json");
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  files.push("package.json");

  console.log(`[build:server] Generated server.js and package.json`);
}

/**
 * Extract API blocks from org AST
 */
interface ApiBlock {
  route: string;
  method: string;
  code: string;
}

function extractApiBlocks(ast: OrgData): ApiBlock[] {
  const blocks: ApiBlock[] = [];

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      const params = parseBlockParameters(node.parameters || null);

      // Check for API block markers
      if (params.use === "api" || params.use === "preview:api") {
        blocks.push({
          route: params.route || "/_api/handler",
          method: (params.method || "GET").toUpperCase(),
          code: node.value || "",
        });
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return blocks;
}

/**
 * Render org AST to HTML components
 */
async function renderOrgToHtml(
  ast: OrgData,
  metadata: Record<string, any>
): Promise<{ html: string; styles: string[]; scripts: string[] }> {
  const styles: string[] = [];
  const scripts: string[] = [];

  // Collect server blocks for async execution
  const serverBlocks: Array<{ id: string; code: string; language: string }> = [];
  let blockCounter = 0;

  // First pass: collect server blocks and render HTML with placeholders
  function renderNode(node: any): string {
    if (!node) return "";

    switch (node.type) {
      case "org-data":
      case "section":
        return (node.children || []).map(renderNode).join("");

      case "headline": {
        // In uniorg AST, headline children are the inline title elements (text, bold, etc.)
        // Content after the headline is handled separately in the parent section
        const level = node.level || 1;
        const tag = `h${Math.min(level + 1, 6)}`;
        // Render title from children (text, bold, italic, etc.)
        const title = (node.children || []).map(renderNode).join("");
        return `<${tag}>${title}</${tag}>`;
      }

      case "paragraph":
        return `<p>${(node.children || []).map(renderNode).join("")}</p>`;

      case "text":
        return escapeHtml(node.value || "");

      case "bold":
        return `<strong>${(node.children || []).map(renderNode).join("")}</strong>`;

      case "italic":
        return `<em>${(node.children || []).map(renderNode).join("")}</em>`;

      case "code":
      case "verbatim":
        return `<code>${escapeHtml(node.value || "")}</code>`;

      case "link":
        const href = node.path?.raw || "#";
        const linkText = (node.children || []).map(renderNode).join("") || href;
        return `<a href="${escapeHtml(href)}">${linkText}</a>`;

      case "src-block": {
        // Use extractUseValue to get the full :use value including pipe syntax
        const useValue = extractUseValue(node.parameters);
        const useFirst = useValue.split("|")[0].trim();
        const useParts = useValue.split("|").map((p: string) => p.trim());

        // Skip API blocks from rendering
        if (useFirst === "api" || useFirst === "preview:api") {
          return "";
        }

        const lang = node.language || "";
        const code = node.value || "";

        // Handle server blocks - execute and show output
        if (useFirst === "server") {
          const blockId = `__SERVER_BLOCK_${blockCounter++}__`;
          serverBlocks.push({ id: blockId, code, language: lang });
          // Return placeholder that will be replaced after execution
          return `<div class="org-server-output">${blockId}</div>`;
        }

        const codeHtml = `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;

        // Check for withSourceCode wrapper
        const hasSourceCode = useParts.some((p: string) =>
          p.startsWith("withSourceCode")
        );

        // For preview blocks with withSourceCode, add a source code label
        if ((useFirst === "preview" || useFirst === "") && hasSourceCode) {
          return `<div class="org-source-code">
            <div class="org-source-label">Source</div>
            ${codeHtml}
          </div>`;
        }

        return codeHtml;
      }

      case "example-block":
      case "export-block":
        return `<pre>${escapeHtml(node.value || "")}</pre>`;

      case "plain-list":
        const listTag = node.listType === "ordered" ? "ol" : "ul";
        return `<${listTag}>${(node.children || []).map(renderNode).join("")}</${listTag}>`;

      case "list-item":
        return `<li>${(node.children || []).map(renderNode).join("")}</li>`;

      case "list-item-tag":
        return `<dt>${(node.children || []).map(renderNode).join("")}</dt>`;

      case "quote-block":
        return `<blockquote>${(node.children || []).map(renderNode).join("")}</blockquote>`;

      default:
        if (node.children) {
          return (node.children || []).map(renderNode).join("");
        }
        return "";
    }
  }

  // Build initial HTML with placeholders for server blocks
  const htmlParts: string[] = [];

  // Add title if present
  if (metadata.title) {
    htmlParts.push(`<h1>${escapeHtml(metadata.title)}</h1>`);
  }

  htmlParts.push(renderNode(ast));

  let html = htmlParts.join("");

  // Execute server blocks and replace placeholders
  if (serverBlocks.length > 0) {
    console.log(`[build:static] Executing ${serverBlocks.length} server block(s)...`);

    const results = await Promise.all(
      serverBlocks.map(async (block) => {
        try {
          const output = await executeServerBlock(block.code, block.language);
          return { id: block.id, output };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          return { id: block.id, output: `<span class="org-error">Error: ${escapeHtml(errorMsg)}</span>` };
        }
      })
    );

    // Replace placeholders with actual output
    for (const result of results) {
      html = html.replace(result.id, result.output);
    }
  }

  // Add basic styles
  styles.push(`
    .org-content {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }
    .org-content pre {
      background: #f4f4f4;
      padding: 1rem;
      overflow-x: auto;
      border-radius: 4px;
    }
    .org-content code {
      font-family: 'SF Mono', Consolas, monospace;
    }
    .org-content blockquote {
      border-left: 4px solid #ddd;
      margin-left: 0;
      padding-left: 1rem;
      color: #666;
    }
    .org-source-code {
      margin: 1rem 0;
    }
    .org-source-label {
      font-size: 0.85rem;
      color: #666;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .org-server-output {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
      white-space: pre-wrap;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9rem;
    }
    .org-error {
      color: #dc3545;
    }
  `);

  return {
    html,
    styles,
    scripts,
  };
}

/**
 * Render org AST to HTML string
 */
async function renderOrgToHtmlString(
  ast: OrgData,
  metadata: Record<string, any>
): Promise<string> {
  const { html, styles, scripts } = await renderOrgToHtml(ast, metadata);
  const title = metadata.title || "Document";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${styles.map((s) => `<style>${s}</style>`).join("\n  ")}
</head>
<body>
  <article class="org-content">
    ${html}
  </article>
  ${scripts.map((s) => `<script type="module">${s}</script>`).join("\n  ")}
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
