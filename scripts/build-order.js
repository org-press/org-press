#!/usr/bin/env node
/**
 * Build Order Analyzer for org-press monorepo
 *
 * Shows the dependency graph and generates optimized build commands that
 * maximize parallelism while respecting dependencies.
 *
 * Usage:
 *   node scripts/build-order.js           # Show full analysis
 *   node scripts/build-order.js --commands # Just show build commands
 *   node scripts/build-order.js --json     # Output as JSON
 *   pnpm build:order                       # Same, via npm script
 *
 * Related files:
 *   .pnpmfile.cjs                         # Enforces dependencies during install
 *   node_modules/.pnpmfile-cache.json     # Cached analysis (auto-invalidated)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const commandsOnly = args.includes('--commands');

/**
 * Get all workspace packages
 */
function getWorkspacePackages() {
  const packages = new Map();

  // Workspace directories to scan
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
        packages.set(pkg.name, {
          name: pkg.name,
          path: dir,
          dependencies: extractWorkspaceDeps(pkg),
          usesOrgpCli: usesOrgpInBuild(pkg),
        });
      }
    } else {
      for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const pkgPath = join(fullDir, entry.name, 'package.json');
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            packages.set(pkg.name, {
              name: pkg.name,
              path: join(dir, entry.name),
              dependencies: extractWorkspaceDeps(pkg),
              usesOrgpCli: usesOrgpInBuild(pkg),
            });
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
 * Check if package uses orgp CLI in build script
 */
function usesOrgpInBuild(pkg) {
  const buildScript = pkg.scripts?.build || '';
  return buildScript.includes('orgp ') || buildScript.includes('orgp\n');
}

/**
 * Topological sort using Kahn's algorithm
 * Returns both sequential order and parallel tiers
 */
function topologicalSort(packages) {
  const inDegree = new Map();
  const adjacency = new Map();

  // Initialize
  for (const [name] of packages) {
    inDegree.set(name, 0);
    adjacency.set(name, []);
  }

  // Build graph
  for (const [name, pkg] of packages) {
    for (const dep of pkg.dependencies) {
      if (packages.has(dep)) {
        adjacency.get(dep).push(name);
        inDegree.set(name, inDegree.get(name) + 1);
      }
    }
  }

  // Find all nodes with no incoming edges
  let queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  // Process nodes tier by tier
  const result = [];
  const tiers = [];

  while (queue.length > 0) {
    // All packages in current queue can be built in parallel
    const currentTier = [...queue].sort(); // Sort for consistent output
    tiers.push(currentTier);
    result.push(...currentTier);

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
  if (result.length !== packages.size) {
    const missing = [...packages.keys()].filter(n => !result.includes(n));
    console.error('❌ Circular dependency detected involving:', missing.join(', '));
    process.exit(1);
  }

  return { order: result, tiers };
}

/**
 * Generate pnpm commands for each tier
 */
function generateBuildCommands(tiers) {
  const commands = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const filters = tier.map(name => `--filter "${name}"`).join(' ');

    if (tier.length === 1) {
      // Single package - run directly
      commands.push({
        tier: i,
        parallel: false,
        packages: tier,
        command: `pnpm --filter "${tier[0]}" build`,
      });
    } else {
      // Multiple packages - can run in parallel
      commands.push({
        tier: i,
        parallel: true,
        packages: tier,
        command: `pnpm ${filters} --parallel build`,
      });
    }
  }

  return commands;
}

/**
 * Generate a single optimized shell script
 */
function generateShellScript(commands) {
  const lines = ['#!/bin/bash', 'set -e', ''];

  for (const cmd of commands) {
    if (cmd.parallel && cmd.packages.length > 1) {
      lines.push(`# Tier ${cmd.tier}: ${cmd.packages.length} packages in parallel`);
    } else {
      lines.push(`# Tier ${cmd.tier}: ${cmd.packages[0]}`);
    }
    lines.push(cmd.command);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main
 */
function main() {
  const packages = getWorkspacePackages();
  const { order, tiers } = topologicalSort(packages);
  const commands = generateBuildCommands(tiers);

  // JSON output mode
  if (jsonOutput) {
    const output = {
      packages: Object.fromEntries(
        [...packages.entries()].map(([name, pkg]) => [
          name,
          { ...pkg, dependencies: [...pkg.dependencies] },
        ])
      ),
      tiers,
      sequentialOrder: order,
      commands: commands.map(c => ({ ...c })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Commands only mode
  if (commandsOnly) {
    console.log('# Optimized build commands (run in order)\n');
    for (const cmd of commands) {
      console.log(cmd.command);
    }
    console.log('\n# Or as a single script:');
    console.log(generateShellScript(commands));
    return;
  }

  // Full analysis mode
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           Org-Press Monorepo Build Order Analysis               ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Summary
  console.log(`Total packages: ${packages.size}`);
  console.log(`Build tiers: ${tiers.length}`);
  console.log(`Packages using orgp CLI: ${[...packages.values()].filter(p => p.usesOrgpCli).length}\n`);

  // Tier breakdown
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ Build Tiers (packages in same tier can be built in PARALLEL)    │');
  console.log('└──────────────────────────────────────────────────────────────────┘\n');

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const parallelNote = tier.length > 1 ? ` ⚡ ${tier.length} packages in parallel` : '';

    console.log(`Tier ${i}:${parallelNote}`);
    console.log('─'.repeat(50));

    for (const name of tier) {
      const pkg = packages.get(name);
      const deps = [...pkg.dependencies];
      const flags = [];
      if (pkg.usesOrgpCli) flags.push('🔧 orgp');

      console.log(`  📦 ${name} ${flags.join(' ')}`);
      console.log(`     └─ ${pkg.path}`);
      if (deps.length > 0) {
        console.log(`     └─ depends on: ${deps.join(', ')}`);
      }
    }
    console.log();
  }

  // Parallelization summary
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ Parallelization Summary                                          │');
  console.log('└──────────────────────────────────────────────────────────────────┘\n');

  const parallelTiers = tiers.filter(t => t.length > 1);
  const sequentialTiers = tiers.filter(t => t.length === 1);

  console.log(`  Sequential tiers (1 package):  ${sequentialTiers.length}`);
  console.log(`  Parallel tiers (2+ packages):  ${parallelTiers.length}`);
  console.log();

  if (parallelTiers.length > 0) {
    console.log('  Parallel opportunities:');
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].length > 1) {
        console.log(`    Tier ${i}: ${tiers[i].join(', ')}`);
      }
    }
    console.log();
  }

  // Build commands
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ Optimized Build Commands                                         │');
  console.log('└──────────────────────────────────────────────────────────────────┘\n');

  console.log('Option 1: Let pnpm handle order (simplest, respects workspace deps):');
  console.log('  pnpm -r build\n');

  console.log('Option 2: Sequential with concurrency=1 (safest):');
  console.log('  pnpm -r --workspace-concurrency=1 build\n');

  console.log('Option 3: Tier-by-tier with parallelism (fastest):');
  for (const cmd of commands) {
    const desc = cmd.parallel ? `(parallel: ${cmd.packages.length})` : '(single)';
    console.log(`  # Tier ${cmd.tier} ${desc}`);
    console.log(`  ${cmd.command}`);
  }
  console.log();

  console.log('Option 4: Shell script for CI:');
  console.log('─'.repeat(50));
  console.log(generateShellScript(commands));
  console.log('─'.repeat(50));

  console.log('\n✅ No circular dependencies detected');
}

main();
