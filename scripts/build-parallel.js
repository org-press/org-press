#!/usr/bin/env node
/**
 * Optimized Parallel Build Script
 *
 * Builds workspace packages with maximum parallelism while respecting dependencies.
 * Uses the same topological sort algorithm as build-order.js but actually executes builds.
 *
 * Usage:
 *   node scripts/build-parallel.js          # Build all packages
 *   node scripts/build-parallel.js --dry    # Show what would be built (no execution)
 *   pnpm build:fast                         # Same, via npm script
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry');

/**
 * Get all workspace packages
 */
function getWorkspacePackages() {
  const packages = new Map();

  const workspaceDirs = [
    { dir: 'packages', type: 'nested' },
    { dir: 'docs', type: 'standalone' },
  ];

  for (const { dir, type } of workspaceDirs) {
    const fullDir = join(ROOT, dir);
    if (!existsSync(fullDir)) continue;

    if (type === 'standalone') {
      const pkgPath = join(fullDir, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.build) {
          packages.set(pkg.name, {
            name: pkg.name,
            path: dir,
            dependencies: extractWorkspaceDeps(pkg),
          });
        }
      }
    } else {
      for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const pkgPath = join(fullDir, entry.name, 'package.json');
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts?.build) {
              packages.set(pkg.name, {
                name: pkg.name,
                path: join(dir, entry.name),
                dependencies: extractWorkspaceDeps(pkg),
              });
            }
          }
        }
      }
    }
  }

  return packages;
}

/**
 * Extract workspace:* dependencies
 */
function extractWorkspaceDeps(pkg) {
  const deps = new Set();

  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const depsObj = pkg[depType] || {};
    for (const [name, version] of Object.entries(depsObj)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        deps.add(name);
      }
    }
  }

  return deps;
}

/**
 * Topological sort - returns tiers of packages that can be built in parallel
 */
function topologicalSort(packages) {
  const inDegree = new Map();
  const adjacency = new Map();

  for (const [name] of packages) {
    inDegree.set(name, 0);
    adjacency.set(name, []);
  }

  for (const [name, pkg] of packages) {
    for (const dep of pkg.dependencies) {
      if (packages.has(dep)) {
        adjacency.get(dep).push(name);
        inDegree.set(name, inDegree.get(name) + 1);
      }
    }
  }

  let queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const tiers = [];

  while (queue.length > 0) {
    const currentTier = [...queue].sort();
    tiers.push(currentTier);

    const nextQueue = [];
    for (const name of queue) {
      for (const dependent of adjacency.get(name)) {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
        if (inDegree.get(dependent) === 0) {
          nextQueue.push(dependent);
        }
      }
    }

    queue = nextQueue;
  }

  // Check for cycles
  const totalProcessed = tiers.reduce((sum, t) => sum + t.length, 0);
  if (totalProcessed !== packages.size) {
    const processed = new Set(tiers.flat());
    const missing = [...packages.keys()].filter(n => !processed.has(n));
    console.error('❌ Circular dependency detected involving:', missing.join(', '));
    process.exit(1);
  }

  return tiers;
}

/**
 * Run a command and return a promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      shell: true,
      cwd: ROOT,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      proc.stdout?.on('data', (data) => { stdout += data; });
      proc.stderr?.on('data', (data) => { stderr += data; });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${command} ${args.join(' ')}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Build a single tier (packages in parallel)
 */
async function buildTier(tierNum, packages) {
  if (packages.length === 0) return;

  const filters = packages.map(name => `--filter "${name}"`).join(' ');
  const parallelFlag = packages.length > 1 ? '--parallel' : '';
  const command = `pnpm ${filters} ${parallelFlag} build`.trim();

  if (packages.length === 1) {
    console.log(`\n📦 Tier ${tierNum}: Building ${packages[0]}`);
  } else {
    console.log(`\n⚡ Tier ${tierNum}: Building ${packages.length} packages in parallel`);
    packages.forEach(p => console.log(`   - ${p}`));
  }

  if (dryRun) {
    console.log(`   [dry-run] ${command}`);
    return;
  }

  const startTime = Date.now();
  await runCommand('pnpm', [filters, parallelFlag, 'build'].filter(Boolean), { shell: true });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`   ✓ Completed in ${elapsed}s`);
}

/**
 * Main
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           Org-Press Optimized Parallel Build                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No builds will be executed\n');
  }

  const packages = getWorkspacePackages();
  const tiers = topologicalSort(packages);

  console.log(`\nPackages: ${packages.size}`);
  console.log(`Tiers: ${tiers.length}`);

  // Calculate parallelization stats
  const parallelTiers = tiers.filter(t => t.length > 1);
  const maxParallel = Math.max(...tiers.map(t => t.length));
  console.log(`Max parallelism: ${maxParallel} packages`);
  console.log(`Parallel tiers: ${parallelTiers.length} of ${tiers.length}`);

  const startTime = Date.now();

  try {
    for (let i = 0; i < tiers.length; i++) {
      await buildTier(i, tiers[i]);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Build complete in ${elapsed}s`);

  } catch (error) {
    console.error(`\n❌ Build failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
