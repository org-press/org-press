/**
 * Deploy a single org file to npm registry
 *
 * This command transforms org files from literate programming documents
 * into distributable npm packages.
 *
 * The org file becomes the single source of truth for:
 * - Package metadata (name, version, description, author)
 * - Executable code (TypeScript/JavaScript transpiled to JavaScript)
 * - Documentation (README.md generated from prose)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { parse } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import { extractMetadata } from "../../parser/metadata.ts";

/**
 * Deploy options
 */
export interface DeployOptions {
  /** Target registry (npm, gitea, or custom URL) */
  registry?: string;
  /** Publish tag (default: latest) */
  tag?: string;
  /** Dry run mode - preview without publishing */
  dryRun?: boolean;
  /** Package access level */
  access?: "public" | "restricted";
  /** Output directory for build */
  outDir?: string;
  /** Skip README generation */
  noReadme?: boolean;
  /** Skip build and publish existing */
  skipBuild?: boolean;
  /** Auto-bump version (patch, minor, major) */
  bump?: "patch" | "minor" | "major";
}

/**
 * Deploy result
 */
export interface DeployResult {
  /** Whether deploy succeeded */
  success: boolean;
  /** Package name */
  packageName: string;
  /** Version deployed */
  version: string;
  /** Registry URL */
  registry: string;
  /** Package URL (if available) */
  url?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Package metadata extracted from org file
 */
interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  keywords?: string[];
  repository?: string;
  homepage?: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Named block from org file for export
 *
 * Blocks are identified by #+NAME: directive:
 * - #+NAME: main - package entry point
 * - #+NAME: types - type definitions
 */
interface NamedBlock {
  name: string;
  language: string;
  code: string;
}

/**
 * Parse deploy command arguments
 */
export function parseDeployArgs(args: string[]): DeployOptions {
  const options: DeployOptions = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--registry" || arg === "-r") {
      options.registry = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--registry=")) {
      options.registry = arg.slice("--registry=".length);
      i++;
      continue;
    }

    if (arg === "--tag" || arg === "-t") {
      options.tag = args[++i];
      i++;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
      i++;
      continue;
    }

    if (arg === "--dry-run" || arg === "-n") {
      options.dryRun = true;
      i++;
      continue;
    }

    if (arg === "--access" || arg === "-a") {
      const access = args[++i] as "public" | "restricted";
      if (!["public", "restricted"].includes(access)) {
        throw new Error(`Invalid access level: ${access}. Must be public or restricted.`);
      }
      options.access = access;
      i++;
      continue;
    }

    if (arg.startsWith("--access=")) {
      const access = arg.slice("--access=".length) as "public" | "restricted";
      if (!["public", "restricted"].includes(access)) {
        throw new Error(`Invalid access level: ${access}. Must be public or restricted.`);
      }
      options.access = access;
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

    if (arg === "--no-readme") {
      options.noReadme = true;
      i++;
      continue;
    }

    if (arg === "--skip-build") {
      options.skipBuild = true;
      i++;
      continue;
    }

    if (arg === "--bump" || arg === "-b") {
      const bump = args[++i] as "patch" | "minor" | "major";
      if (!["patch", "minor", "major"].includes(bump)) {
        throw new Error(`Invalid bump type: ${bump}. Must be patch, minor, or major.`);
      }
      options.bump = bump;
      i++;
      continue;
    }

    if (arg.startsWith("--bump=")) {
      const bump = arg.slice("--bump=".length) as "patch" | "minor" | "major";
      if (!["patch", "minor", "major"].includes(bump)) {
        throw new Error(`Invalid bump type: ${bump}. Must be patch, minor, or major.`);
      }
      options.bump = bump;
      i++;
      continue;
    }

    // Skip unknown flags
    if (arg.startsWith("-")) {
      i++;
      continue;
    }

    i++;
  }

  return options;
}

/**
 * Deploy a single org file to npm
 */
export async function deploySingleFile(
  file: string,
  options: DeployOptions = {}
): Promise<DeployResult> {
  // Resolve file path
  const filePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      packageName: "",
      version: "",
      registry: "",
      error: `File not found: ${filePath}`,
    };
  }

  console.log(`[deploy] Parsing ${file}...`);

  // Read and parse the org file
  const source = fs.readFileSync(filePath, "utf-8");
  const cleanSource = source.startsWith("#!") ? source.replace(/^#!.*\n/, "") : source;
  const ast = parse(cleanSource) as OrgData;

  // Extract metadata
  const metadata = extractPackageMetadata(ast, filePath);

  if (!metadata.name) {
    return {
      success: false,
      packageName: "",
      version: "",
      registry: "",
      error: "Missing required metadata: #+TITLE: (package name)",
    };
  }

  // Handle version bumping
  let version = metadata.version || "1.0.0";
  if (options.bump) {
    version = bumpVersion(version, options.bump);
    console.log(`[deploy] Bumped version: ${metadata.version || "1.0.0"} -> ${version}`);
  }

  if (!version) {
    return {
      success: false,
      packageName: metadata.name,
      version: "",
      registry: "",
      error: "Missing required metadata: #+VERSION:",
    };
  }

  console.log(`[deploy] Found package: ${metadata.name}@${version}`);

  // Extract named blocks for export (#+NAME: main, #+NAME: types)
  const namedBlocks = extractNamedBlocks(ast);
  console.log(`[deploy] Found ${namedBlocks.length} named blocks`);

  const mainBlock = namedBlocks.find(b => b.name === "main");
  if (!mainBlock) {
    return {
      success: false,
      packageName: metadata.name,
      version,
      registry: "",
      error: "No 'main' block found. Use #+NAME: main to mark the entry point.",
    };
  }

  // Determine output directory
  const outDir = options.outDir || path.resolve(process.cwd(), ".orgp-deploy");

  // Build the package
  if (!options.skipBuild) {
    console.log(`[deploy] Building package...`);
    await buildPackage(filePath, ast, metadata, version, namedBlocks, outDir, options);
  }

  // Determine registry
  const registry = options.registry || "https://registry.npmjs.org";

  if (options.dryRun) {
    console.log(`\n[deploy] Dry run - would publish to: ${registry}`);
    console.log(`[deploy] Package: ${metadata.name}@${version}`);
    console.log(`[deploy] Tag: ${options.tag || "latest"}`);
    console.log(`[deploy] Access: ${options.access || "public"}`);
    console.log(`\nPackage contents:`);
    listDirectory(outDir, "  ");

    return {
      success: true,
      packageName: metadata.name,
      version,
      registry,
    };
  }

  // Publish to registry
  console.log(`[deploy] Publishing to ${registry}...`);
  try {
    const publishArgs = ["publish"];
    if (options.tag) {
      publishArgs.push("--tag", options.tag);
    }
    if (options.access) {
      publishArgs.push("--access", options.access);
    }

    const result = spawnSync("npm", publishArgs, {
      cwd: outDir,
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_registry: registry,
      },
    });

    if (result.status !== 0) {
      return {
        success: false,
        packageName: metadata.name,
        version,
        registry,
        error: `npm publish failed with exit code ${result.status}`,
      };
    }

    const url = registry.includes("npmjs.org")
      ? `https://www.npmjs.com/package/${metadata.name}`
      : undefined;

    return {
      success: true,
      packageName: metadata.name,
      version,
      registry,
      url,
    };
  } catch (error) {
    return {
      success: false,
      packageName: metadata.name,
      version,
      registry,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract package metadata from org AST
 */
function extractPackageMetadata(ast: OrgData, filePath: string): PackageMetadata {
  const rawMetadata = extractMetadata(ast);

  // Map org keywords to package.json fields
  const metadata: PackageMetadata = {
    name: rawMetadata.title || path.basename(filePath, ".org"),
    version: rawMetadata.version,
    description: rawMetadata.description,
    author: rawMetadata.author,
    license: rawMetadata.license || "MIT",
    keywords: rawMetadata.keywords
      ? rawMetadata.keywords.split(",").map((k: string) => k.trim())
      : undefined,
    repository: rawMetadata.repository,
    homepage: rawMetadata.homepage,
    engines: rawMetadata.node_version ? { node: rawMetadata.node_version } : undefined,
    dependencies: parseDependencies(rawMetadata.dependencies),
    peerDependencies: parseDependencies(rawMetadata.peer_deps),
    devDependencies: parseDependencies(rawMetadata.dev_deps),
  };

  return metadata;
}

/**
 * Parse dependency string into version map
 */
function parseDependencies(deps: string | undefined): Record<string, string> | undefined {
  if (!deps) return undefined;

  const result: Record<string, string> = {};
  const parts = deps.split(",").map((p) => p.trim());

  for (const part of parts) {
    if (!part) continue;
    const [name, version] = part.split("@");
    if (name) {
      result[name] = version || "*";
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract named blocks from org AST
 *
 * Looks for blocks with #+NAME: directive that should be exported:
 * - main: package entry point
 * - types: type definitions
 */
function extractNamedBlocks(ast: OrgData): NamedBlock[] {
  const blocks: NamedBlock[] = [];

  function walk(node: any): void {
    if (!node) return;

    if (node.type === "src-block") {
      const name = node.affiliated?.NAME;

      // Only include blocks with a name (used for export)
      if (name) {
        blocks.push({
          name,
          language: node.language || "javascript",
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
 * Build the package directory
 */
async function buildPackage(
  filePath: string,
  ast: OrgData,
  metadata: PackageMetadata,
  version: string,
  namedBlocks: NamedBlock[],
  outDir: string,
  options: DeployOptions
): Promise<void> {
  // Clean and create output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // Create dist directory
  const distDir = path.join(outDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });

  // Transpile named blocks
  for (const block of namedBlocks) {
    // main -> index.js, types -> types.js, etc.
    const outputFile = block.name === "main" ? "index.js" : `${block.name}.js`;
    const outputPath = path.join(distDir, outputFile);

    // Simple transpilation - strip TypeScript types
    const code = transpileCode(block.code, block.language);
    fs.writeFileSync(outputPath, code);

    console.log(`[deploy]   ✓ Generated dist/${outputFile}`);
  }

  // Generate package.json
  const packageJson = generatePackageJson(metadata, version, namedBlocks);
  fs.writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
  console.log(`[deploy]   ✓ Generated package.json`);

  // Generate README.md
  if (!options.noReadme) {
    const readme = generateReadme(ast, metadata);
    fs.writeFileSync(path.join(outDir, "README.md"), readme);
    console.log(`[deploy]   ✓ Generated README.md`);
  }
}

/**
 * Generate package.json
 */
function generatePackageJson(
  metadata: PackageMetadata,
  version: string,
  namedBlocks: NamedBlock[]
): object {
  const mainBlock = namedBlocks.find((b) => b.name === "main");
  const exports: Record<string, any> = {};

  // Build exports map
  if (mainBlock) {
    exports["."] = {
      import: "./dist/index.js",
    };
  }

  for (const block of namedBlocks) {
    if (block.name !== "main") {
      exports[`./${block.name}`] = {
        import: `./dist/${block.name}.js`,
      };
    }
  }

  const packageJson: Record<string, any> = {
    name: metadata.name,
    version,
    description: metadata.description,
    type: "module",
    main: "./dist/index.js",
    exports: Object.keys(exports).length > 0 ? exports : undefined,
    files: ["dist", "README.md"],
    keywords: metadata.keywords,
    author: metadata.author,
    license: metadata.license,
    repository: metadata.repository
      ? { type: "git", url: metadata.repository }
      : undefined,
    homepage: metadata.homepage,
    engines: metadata.engines,
    dependencies: metadata.dependencies,
    peerDependencies: metadata.peerDependencies,
    devDependencies: metadata.devDependencies,
  };

  // Remove undefined values
  for (const key of Object.keys(packageJson)) {
    if (packageJson[key] === undefined) {
      delete packageJson[key];
    }
  }

  return packageJson;
}

/**
 * Generate README.md from org content
 */
function generateReadme(ast: OrgData, metadata: PackageMetadata): string {
  const parts: string[] = [];

  // Title
  parts.push(`# ${metadata.name}\n`);

  // Description
  if (metadata.description) {
    parts.push(`${metadata.description}\n`);
  }

  // Installation
  parts.push("## Installation\n");
  parts.push("```bash");
  parts.push(`npm install ${metadata.name}`);
  parts.push("```\n");

  // Extract prose content from org file
  const prose = extractProse(ast);
  if (prose) {
    parts.push("## Overview\n");
    parts.push(prose);
    parts.push("");
  }

  // License
  if (metadata.license) {
    parts.push("## License\n");
    parts.push(`${metadata.license}`);
  }

  return parts.join("\n");
}

/**
 * Extract prose content from org AST (excluding code blocks)
 */
function extractProse(ast: OrgData): string {
  const lines: string[] = [];

  function walk(node: any, depth = 0): void {
    if (!node) return;

    switch (node.type) {
      case "headline": {
        const level = node.level || 1;
        const title = extractText(node.children?.find((c: any) => c.type === "headline-title"));
        if (title) {
          lines.push(`${"#".repeat(level + 1)} ${title}\n`);
        }
        break;
      }

      case "paragraph": {
        const text = extractText(node);
        if (text) {
          lines.push(`${text}\n`);
        }
        break;
      }

      case "plain-list": {
        for (const item of node.children || []) {
          const text = extractText(item);
          if (text) {
            lines.push(`- ${text}`);
          }
        }
        lines.push("");
        break;
      }

      case "src-block": {
        // Include all code blocks in README (named blocks are for export)
        const lang = node.language || "";
        lines.push(`\`\`\`${lang}`);
        lines.push(node.value || "");
        lines.push("```\n");
        break;
      }
    }

    if (node.children && node.type !== "src-block") {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(ast);
  return lines.join("\n").trim();
}

/**
 * Extract plain text from a node
 */
function extractText(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    return node.value || "";
  }

  if (node.children) {
    return node.children.map(extractText).join("");
  }

  return "";
}

/**
 * Simple TypeScript to JavaScript transpilation
 */
function transpileCode(code: string, language: string): string {
  // For now, just strip TypeScript type annotations
  // In production, this would use esbuild or tsc
  if (!["typescript", "ts", "tsx"].includes(language)) {
    return code;
  }

  // Remove type annotations (simplified)
  let result = code;

  // Remove type imports
  result = result.replace(/import\s+type\s+.*?from\s+['"].*?['"];?\n?/g, "");

  // Remove interface and type declarations
  result = result.replace(/^(export\s+)?(interface|type)\s+\w+.*?(?=\n(export|const|function|class|import|$))/gms, "");

  // Remove type annotations from variables
  result = result.replace(/:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(?=\s*[=;,)])/g, "");

  // Remove type parameters
  result = result.replace(/<[^>]+>(?=\s*\()/g, "");

  // Remove return type annotations
  result = result.replace(/\):\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*\s*(?=[{=])/g, ") ");

  // Remove 'as' type assertions
  result = result.replace(/\s+as\s+\w+(\[\])?/g, "");

  return result;
}

/**
 * Bump version according to semver
 */
function bumpVersion(version: string, type: "patch" | "minor" | "major"): string {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);

  while (parts.length < 3) {
    parts.push(0);
  }

  switch (type) {
    case "major":
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case "minor":
      parts[1]++;
      parts[2] = 0;
      break;
    case "patch":
      parts[2]++;
      break;
  }

  return parts.join(".");
}

/**
 * List directory contents recursively
 */
function listDirectory(dir: string, prefix: string = ""): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      console.log(`${prefix}${entry.name}/`);
      listDirectory(path.join(dir, entry.name), prefix + "  ");
    } else {
      const stats = fs.statSync(path.join(dir, entry.name));
      const size = formatBytes(stats.size);
      console.log(`${prefix}${entry.name} (${size})`);
    }
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
