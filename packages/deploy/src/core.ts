/**
 * DeployCore - Orchestrator for the deploy pipeline
 *
 * Handles the full deployment workflow:
 * 1. Parse org file and extract metadata
 * 2. Resolve adapter (from options or registry)
 * 3. Validate adapter configuration
 * 4. Build package artifacts
 * 5. Execute deployment
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseOrg } from "uniorg-parse/lib/parser.js";
import type { OrgData } from "uniorg";
import type {
  DeployAdapter,
  DeployContext,
  DeployOptions,
  DeployResult,
  DeployLogger,
  PackageMetadata,
  AdapterConfig,
  ValidationResult,
} from "./types.ts";
import { getAdapter, initBuiltinAdapters } from "./adapters/index.ts";
import {
  extractPackageMetadata,
  extractNamedBlocks,
  bumpVersion,
  buildPackage,
} from "./utils/index.ts";

/**
 * Result of the deploy operation including build info
 */
export interface DeployCoreResult extends DeployResult {
  /** Package metadata extracted from org file */
  metadata?: PackageMetadata;
  /** Build output directory */
  outDir?: string;
  /** Files generated during build */
  files?: string[];
}

/**
 * Options for the deploy function
 */
export interface DeployCoreOptions extends DeployOptions {
  /** Org file path to deploy */
  orgFile: string;
  /** Logger for output */
  logger?: DeployLogger;
  /** Skip validation step */
  skipValidation?: boolean;
}

/**
 * Deploy an org file to a target
 *
 * This is the main entry point for the deploy pipeline.
 * It orchestrates parsing, building, and deployment.
 *
 * @example
 * ```typescript
 * import { deploy } from '@org-press/deploy';
 *
 * const result = await deploy({
 *   orgFile: 'my-package.org',
 *   adapter: 'npm',
 *   dryRun: true,
 * });
 *
 * if (result.success) {
 *   console.log('Deployed to:', result.url);
 * }
 * ```
 */
export async function deploy(options: DeployCoreOptions): Promise<DeployCoreResult> {
  const {
    orgFile,
    adapter: adapterOption,
    registry,
    tag,
    dryRun = false,
    access,
    outDir: customOutDir,
    noReadme = false,
    skipBuild = false,
    bump,
    environment = "production",
    logger = createConsoleLogger(),
    skipValidation = false,
  } = options;

  // Ensure built-in adapters are registered
  initBuiltinAdapters();

  // Resolve file path
  const orgFilePath = path.resolve(orgFile);

  if (!fs.existsSync(orgFilePath)) {
    return {
      success: false,
      error: `File not found: ${orgFilePath}`,
    };
  }

  logger.info(`Deploying ${orgFilePath}`);

  // Step 1: Parse org file
  logger.debug("Parsing org file...");
  const content = fs.readFileSync(orgFilePath, "utf-8");
  const ast = parseOrg(content) as OrgData;

  // Step 2: Extract metadata and named blocks
  const fallbackName = path.basename(orgFilePath, ".org");
  let metadata = extractPackageMetadata(ast, fallbackName);
  const namedBlocks = extractNamedBlocks(ast);

  if (namedBlocks.length === 0) {
    return {
      success: false,
      error: "No named blocks found in org file. Use #+NAME: to mark blocks for export.",
    };
  }

  // Apply version bump if requested
  if (bump) {
    metadata = {
      ...metadata,
      version: bumpVersion(metadata.version, bump),
    };
    logger.info(`Bumped version to ${metadata.version}`);
  }

  logger.info(`Package: ${metadata.name}@${metadata.version}`);
  logger.info(`Named blocks: ${namedBlocks.map((b) => b.name).join(", ")}`);

  // Step 3: Resolve adapter
  const adapter = resolveAdapter(adapterOption, logger);
  if (!adapter) {
    const adapterName = typeof adapterOption === "string" ? adapterOption : "default";
    return {
      success: false,
      error: `Adapter '${adapterName}' not found. Available: npm`,
    };
  }

  logger.info(`Using adapter: ${adapter.name}`);

  // Step 4: Validate adapter configuration
  if (!skipValidation) {
    const adapterConfig: AdapterConfig = {
      options: { registry, tag, access },
      env: process.env as Record<string, string | undefined>,
    };

    logger.debug("Validating adapter configuration...");
    const validation = await adapter.validate(adapterConfig);

    logValidation(validation, logger);

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }
  }

  // Step 5: Build package
  const outDir = customOutDir || path.join(path.dirname(orgFilePath), ".deploy", metadata.name);
  let files: string[] = [];

  if (!skipBuild) {
    logger.info(`Building to ${outDir}...`);

    const buildResult = await buildPackage(outDir, ast, metadata, namedBlocks, {
      noReadme,
      logger,
    });

    files = buildResult.files;
    logger.info(`Generated ${files.length} files`);
  } else {
    logger.info("Skipping build (--skip-build)");
    if (!fs.existsSync(outDir)) {
      return {
        success: false,
        error: `Output directory not found: ${outDir}. Cannot skip build without existing artifacts.`,
      };
    }
  }

  // Step 6: Deploy
  const deployContext: DeployContext = {
    outDir,
    orgFile: orgFilePath,
    metadata,
    adapterConfig: { registry, tag, access },
    environment,
    dryRun,
    logger,
  };

  logger.info(dryRun ? "Executing dry run..." : "Deploying...");

  const result = await adapter.deploy(deployContext);

  // Return combined result
  return {
    ...result,
    metadata,
    outDir,
    files,
  };
}

/**
 * Resolve adapter from options
 *
 * @param adapterOption - Adapter name, instance, or undefined
 * @param logger - Logger for output
 * @returns Resolved adapter or undefined
 */
function resolveAdapter(
  adapterOption: string | DeployAdapter | undefined,
  logger: DeployLogger
): DeployAdapter | undefined {
  // If adapter instance provided, use it directly
  if (adapterOption && typeof adapterOption === "object") {
    return adapterOption;
  }

  // Resolve by name (default to 'npm')
  const adapterName = typeof adapterOption === "string" ? adapterOption : "npm";
  const adapter = getAdapter(adapterName);

  if (!adapter) {
    logger.error(`Adapter '${adapterName}' not found in registry`);
  }

  return adapter;
}

/**
 * Log validation results
 */
function logValidation(validation: ValidationResult, logger: DeployLogger): void {
  for (const warning of validation.warnings) {
    logger.warn(warning);
  }

  for (const error of validation.errors) {
    logger.error(error);
  }

  if (validation.valid) {
    logger.debug("Validation passed");
  }
}

/**
 * Create a console logger with standard prefixes
 */
export function createConsoleLogger(options: { verbose?: boolean } = {}): DeployLogger {
  const { verbose = false } = options;

  return {
    info: (message: string) => console.log(`[deploy] ${message}`),
    warn: (message: string) => console.warn(`[deploy] WARN: ${message}`),
    error: (message: string) => console.error(`[deploy] ERROR: ${message}`),
    debug: (message: string) => {
      if (verbose || process.env.DEBUG) {
        console.log(`[deploy] DEBUG: ${message}`);
      }
    },
  };
}

/**
 * Create a silent logger (for testing)
 */
export function createSilentLogger(): DeployLogger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

/**
 * Create a buffered logger that captures all output
 */
export function createBufferedLogger(): DeployLogger & { logs: string[] } {
  const logs: string[] = [];

  return {
    logs,
    info: (message: string) => logs.push(`INFO: ${message}`),
    warn: (message: string) => logs.push(`WARN: ${message}`),
    error: (message: string) => logs.push(`ERROR: ${message}`),
    debug: (message: string) => logs.push(`DEBUG: ${message}`),
  };
}
