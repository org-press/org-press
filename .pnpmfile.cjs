/**
 * pnpm hooks for org-press monorepo
 *
 * Dynamically analyzes workspace packages to ensure proper build order.
 * Packages that use `orgp` CLI in their build scripts need `org-press` built first.
 *
 * Features:
 * - Dynamic package discovery (no hardcoded lists)
 * - Caching based on package.json timestamps
 * - Automatic dependency injection for orgp CLI users
 *
 * Usage:
 * - pnpm install                    # Normal install with dynamic analysis
 * - DEBUG=pnpmfile pnpm install     # Show debug output
 * - PNPMFILE_NO_CACHE=1 pnpm install # Force re-scan (ignore cache)
 *
 * @see https://pnpm.io/pnpmfile
 */

const fs = require('node:fs');
const path = require('node:path');

// Cache location (in node_modules to auto-invalidate on clean install)
const CACHE_FILE = path.join(__dirname, 'node_modules', '.pnpmfile-cache.json');

// Workspace locations to scan
const WORKSPACE_DIRS = [
  { dir: 'packages', type: 'package' },
  { dir: 'docs', type: 'standalone' },
];

/**
 * Cached analysis result
 * @type {{
 *   timestamp: number,
 *   packages: Map<string, { usesOrgpCli: boolean, dependencies: string[], path: string }>,
 *   orgpCliDependents: string[],
 *   tiers: Record<string, number>
 * } | null}
 */
let cachedAnalysis = null;

/**
 * Load cache from disk
 */
function loadCache() {
  if (process.env.PNPMFILE_NO_CACHE === '1') {
    return null;
  }

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return data;
    }
  } catch (e) {
    // Cache corrupted or unreadable
  }
  return null;
}

/**
 * Save cache to disk
 */
function saveCache(analysis) {
  try {
    // Ensure directory exists
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Convert Map to object for JSON serialization
    const serializable = {
      ...analysis,
      packages: Object.fromEntries(analysis.packages),
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(serializable, null, 2));
  } catch (e) {
    // Cache write failed, not critical
  }
}

/**
 * Get the latest mtime from all package.json files
 */
function getLatestPackageJsonMtime() {
  let latestMtime = 0;

  for (const { dir, type } of WORKSPACE_DIRS) {
    const fullDir = path.join(__dirname, dir);

    if (!fs.existsSync(fullDir)) continue;

    if (type === 'standalone') {
      // Single package (e.g., docs/)
      const pkgPath = path.join(fullDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const stat = fs.statSync(pkgPath);
        latestMtime = Math.max(latestMtime, stat.mtimeMs);
      }
    } else {
      // Directory of packages (e.g., packages/*)
      const entries = fs.readdirSync(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgPath = path.join(fullDir, entry.name, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const stat = fs.statSync(pkgPath);
            latestMtime = Math.max(latestMtime, stat.mtimeMs);
          }
        }
      }
    }
  }

  // Also check root package.json
  const rootPkgPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const stat = fs.statSync(rootPkgPath);
    latestMtime = Math.max(latestMtime, stat.mtimeMs);
  }

  return latestMtime;
}

/**
 * Check if package uses orgp CLI in build script
 */
function usesOrgpInBuild(pkg) {
  const buildScript = pkg.scripts?.build || '';
  return buildScript.includes('orgp ') || buildScript.includes('orgp\n');
}

/**
 * Extract workspace:* dependencies from a package
 */
function extractWorkspaceDeps(pkg) {
  const deps = [];

  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const depsObj = pkg[depType] || {};
    for (const [name, version] of Object.entries(depsObj)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        deps.push(name);
      }
    }
  }

  return deps;
}

/**
 * Scan all workspace packages and build dependency graph
 */
function analyzeWorkspace() {
  const packages = new Map();

  for (const { dir, type } of WORKSPACE_DIRS) {
    const fullDir = path.join(__dirname, dir);

    if (!fs.existsSync(fullDir)) continue;

    if (type === 'standalone') {
      // Single package (e.g., docs/)
      const pkgPath = path.join(fullDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        packages.set(pkg.name, {
          usesOrgpCli: usesOrgpInBuild(pkg),
          dependencies: extractWorkspaceDeps(pkg),
          path: dir,
        });
      }
    } else {
      // Directory of packages (e.g., packages/*)
      const entries = fs.readdirSync(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgPath = path.join(fullDir, entry.name, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            packages.set(pkg.name, {
              usesOrgpCli: usesOrgpInBuild(pkg),
              dependencies: extractWorkspaceDeps(pkg),
              path: path.join(dir, entry.name),
            });
          }
        }
      }
    }
  }

  // Build list of packages that use orgp CLI
  const orgpCliDependents = [];
  for (const [name, info] of packages) {
    if (info.usesOrgpCli) {
      orgpCliDependents.push(name);
    }
  }

  // Calculate build tiers using topological sort
  const tiers = calculateBuildTiers(packages);

  return {
    timestamp: getLatestPackageJsonMtime(),
    packages,
    orgpCliDependents,
    tiers,
  };
}

/**
 * Calculate build tiers using Kahn's topological sort algorithm
 */
function calculateBuildTiers(packages) {
  const inDegree = new Map();
  const adjacency = new Map();
  const tiers = {};

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

  // Process tiers
  let queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  let tierNum = 0;
  while (queue.length > 0) {
    const nextQueue = [];

    for (const name of queue) {
      tiers[name] = tierNum;

      for (const dependent of adjacency.get(name)) {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
        if (inDegree.get(dependent) === 0) {
          nextQueue.push(dependent);
        }
      }
    }

    queue = nextQueue;
    tierNum++;
  }

  return tiers;
}

/**
 * Get or compute workspace analysis (with caching)
 */
function getAnalysis(context) {
  // Return cached if available
  if (cachedAnalysis) {
    return cachedAnalysis;
  }

  // Try to load from disk cache
  const diskCache = loadCache();
  const currentMtime = getLatestPackageJsonMtime();

  if (diskCache && diskCache.timestamp >= currentMtime) {
    // Cache is valid
    cachedAnalysis = {
      ...diskCache,
      packages: new Map(Object.entries(diskCache.packages)),
    };

    if (process.env.DEBUG === 'pnpmfile') {
      context.log('[pnpmfile] Using cached analysis');
    }

    return cachedAnalysis;
  }

  // Cache miss or stale - re-analyze
  if (process.env.DEBUG === 'pnpmfile') {
    context.log('[pnpmfile] Analyzing workspace packages...');
  }

  cachedAnalysis = analyzeWorkspace();
  saveCache(cachedAnalysis);

  if (process.env.DEBUG === 'pnpmfile') {
    context.log(`[pnpmfile] Found ${cachedAnalysis.packages.size} packages`);
    context.log(`[pnpmfile] orgp CLI users: ${cachedAnalysis.orgpCliDependents.join(', ') || 'none'}`);
    context.log(`[pnpmfile] Build tiers: ${JSON.stringify(cachedAnalysis.tiers)}`);
  }

  return cachedAnalysis;
}

/**
 * Hook called for each package.json read
 *
 * We use this to:
 * 1. Log dependency information (when DEBUG=pnpmfile)
 * 2. Inject org-press dependency for packages that use orgp CLI
 */
function readPackage(pkg, context) {
  const analysis = getAnalysis(context);

  // Log for debugging
  if (process.env.DEBUG === 'pnpmfile') {
    const tier = analysis.tiers[pkg.name];
    if (tier !== undefined) {
      context.log(`[pnpmfile] ${pkg.name} (tier ${tier})`);
    }
  }

  // Ensure packages that use orgp CLI have org-press as a dev dependency
  if (analysis.orgpCliDependents.includes(pkg.name)) {
    if (!pkg.devDependencies) {
      pkg.devDependencies = {};
    }

    // Ensure workspace dependency is set
    if (!pkg.devDependencies['org-press']) {
      pkg.devDependencies['org-press'] = 'workspace:*';
      if (process.env.DEBUG === 'pnpmfile') {
        context.log(`[pnpmfile] Added org-press dependency to ${pkg.name}`);
      }
    }
  }

  return pkg;
}

/**
 * Hook called after all dependencies are resolved
 */
function afterAllResolved(lockfile, context) {
  if (process.env.DEBUG === 'pnpmfile') {
    context.log('[pnpmfile] Dependencies resolved');
  }
  return lockfile;
}

module.exports = {
  hooks: {
    readPackage,
    afterAllResolved,
  },
};
