#!/usr/bin/env node
/**
 * Internal Link Checker for docs/dist
 *
 * Scans all HTML files and verifies that internal links point to existing files.
 * Reports broken links with the source file and line context.
 *
 * Usage: node scripts/check-links.js [dist-dir]
 *        Default dist-dir: docs/dist
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// ANSI colors for terminal output
const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Recursively get all HTML files in a directory
 */
async function getHtmlFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await getHtmlFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract all internal links from HTML content
 */
function extractLinks(html, filePath) {
  const links = [];

  // Match href="..." and src="..."
  const hrefRegex = /(?:href|src)=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];

    // Skip external links, anchors, data URIs, javascript, mailto, tel
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("//") ||
      url.startsWith("#") ||
      url.startsWith("data:") ||
      url.startsWith("javascript:") ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:")
    ) {
      continue;
    }

    // Find line number for context
    const beforeMatch = html.substring(0, match.index);
    const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

    links.push({
      url,
      lineNumber,
      context: match[0],
    });
  }

  return links;
}

/**
 * Resolve a link URL to an absolute file path
 */
function resolveLink(url, sourceFile, distDir) {
  // Remove query string and hash
  let cleanUrl = url.split("?")[0].split("#")[0];

  // Handle root-relative URLs
  if (cleanUrl.startsWith("/")) {
    cleanUrl = cleanUrl.substring(1);
    return join(distDir, cleanUrl);
  }

  // Handle relative URLs
  const sourceDir = dirname(sourceFile);
  return resolve(sourceDir, cleanUrl);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.isFile() || stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path resolves to a valid resource
 * Handles: direct files, directory with index.html, .html extension fallback
 */
async function isValidLink(resolvedPath, distDir) {
  // Direct file exists
  if (await fileExists(resolvedPath)) {
    return true;
  }

  // Try with .html extension
  if (!extname(resolvedPath) && (await fileExists(resolvedPath + ".html"))) {
    return true;
  }

  // Try directory/index.html
  if (await fileExists(join(resolvedPath, "index.html"))) {
    return true;
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  const distDir = resolve(rootDir, process.argv[2] || "docs/dist");

  console.log(colors.cyan(`\nChecking internal links in: ${distDir}\n`));

  // Check if dist directory exists
  try {
    await stat(distDir);
  } catch {
    console.error(colors.red(`Error: Directory not found: ${distDir}`));
    console.error(colors.dim("Run the build first: cd docs && pnpm build"));
    process.exit(1);
  }

  // Get all HTML files
  const htmlFiles = await getHtmlFiles(distDir);
  console.log(colors.dim(`Found ${htmlFiles.length} HTML files\n`));

  let totalLinks = 0;
  let brokenLinks = 0;
  const brokenByFile = new Map();

  // Check each file
  for (const filePath of htmlFiles) {
    const relativePath = filePath.replace(distDir + "/", "");
    const html = await readFile(filePath, "utf-8");
    const links = extractLinks(html, filePath);

    for (const link of links) {
      totalLinks++;
      const resolvedPath = resolveLink(link.url, filePath, distDir);

      if (!(await isValidLink(resolvedPath, distDir))) {
        brokenLinks++;

        if (!brokenByFile.has(relativePath)) {
          brokenByFile.set(relativePath, []);
        }
        brokenByFile.get(relativePath).push({
          ...link,
          resolvedPath: resolvedPath.replace(distDir + "/", ""),
        });
      }
    }
  }

  // Report results
  if (brokenLinks === 0) {
    console.log(colors.green(`✓ All ${totalLinks} internal links are valid\n`));
    process.exit(0);
  }

  console.log(colors.red(`✗ Found ${brokenLinks} broken links:\n`));

  for (const [file, links] of brokenByFile) {
    console.log(colors.yellow(`  ${file}:`));
    for (const link of links) {
      console.log(colors.dim(`    Line ${link.lineNumber}: `) + colors.red(link.url));
      console.log(colors.dim(`      → Would resolve to: ${link.resolvedPath}`));
    }
    console.log();
  }

  console.log(
    colors.dim(`\nTotal: ${brokenLinks} broken / ${totalLinks} links checked\n`)
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(colors.red("Error:"), err.message);
  process.exit(1);
});
