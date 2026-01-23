/**
 * Wrapper Composition Engine
 *
 * Composes Preview functions by applying wrappers from a pipeline.
 * Wrappers are applied right-to-left (innermost first).
 *
 * @example
 * ```typescript
 * // Pipeline: preview | withTabs | withSourceCode
 * // Composition: withSourceCode(withTabs(preview))
 * // Execution: withSourceCode wraps withTabs which wraps preview
 * ```
 */

import type { PreviewFn, Wrapper, WrapperFactory } from "./preview.ts";
import type { PipeSegment } from "./pipe-parser.ts";
import { defaultPreview } from "./preview.ts";

// Re-export types for convenience
export type { WrapperFactory } from "./preview.ts";

/**
 * Registry of available wrappers
 */
export interface WrapperRegistry {
  /** Get a wrapper factory by name */
  get(name: string): WrapperFactory | undefined;

  /** Check if a wrapper exists */
  has(name: string): boolean;

  /** Get all wrapper names */
  keys(): string[];
}

/**
 * Simple map-based wrapper registry
 */
export class MapWrapperRegistry implements WrapperRegistry {
  private wrappers = new Map<string, WrapperFactory>();

  register(name: string, factory: WrapperFactory): void {
    this.wrappers.set(name, factory);
  }

  get(name: string): WrapperFactory | undefined {
    return this.wrappers.get(name);
  }

  has(name: string): boolean {
    return this.wrappers.has(name);
  }

  keys(): string[] {
    return Array.from(this.wrappers.keys());
  }
}

/**
 * Options for composing wrappers
 */
export interface ComposeOptions {
  /** Wrapper registry to resolve wrapper names */
  registry?: WrapperRegistry;

  /** Base preview function (default: defaultPreview) */
  basePreview?: PreviewFn;

  /** Handler for org file imports */
  resolveOrgImport?: (segment: PipeSegment) => Promise<WrapperFactory | null>;

  /** Handler for unknown wrappers */
  onUnknownWrapper?: (name: string) => void;
}

/**
 * Compose a pipeline of wrappers into a single PreviewFn
 *
 * @param segments - Parsed pipe segments (from parsePipe)
 * @param options - Composition options
 * @returns Composed preview function
 *
 * @example
 * ```typescript
 * const segments = parsePipe("preview | withTabs | withSourceCode");
 * const composed = await composeWrappers(segments, { registry });
 * const result = composed(executionResult, ctx);
 * ```
 */
export async function composeWrappers(
  segments: PipeSegment[],
  options: ComposeOptions = {}
): Promise<PreviewFn> {
  const {
    registry,
    basePreview = defaultPreview,
    resolveOrgImport,
    onUnknownWrapper,
  } = options;

  if (segments.length === 0) {
    return basePreview;
  }

  // Resolve all wrappers
  const wrappers: Wrapper[] = [];

  // Skip the first segment (mode) - wrappers start from index 1
  // If there's only one segment, it's the mode/base, no wrappers
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const wrapper = await resolveWrapper(segment, {
      registry,
      resolveOrgImport,
      onUnknownWrapper,
    });

    if (wrapper) {
      wrappers.push(wrapper);
    }
  }

  // Compose wrappers right-to-left
  // [w1, w2, w3] => w1(w2(w3(preview)))
  return wrappers.reduceRight(
    (preview, wrapper) => wrapper(preview),
    basePreview
  );
}

/**
 * Resolve a single wrapper from a segment
 */
async function resolveWrapper(
  segment: PipeSegment,
  options: {
    registry?: WrapperRegistry;
    resolveOrgImport?: (segment: PipeSegment) => Promise<WrapperFactory | null>;
    onUnknownWrapper?: (name: string) => void;
  }
): Promise<Wrapper | null> {
  const { registry, resolveOrgImport, onUnknownWrapper } = options;

  // Handle org file imports
  if (segment.isOrgImport) {
    if (resolveOrgImport) {
      const factory = await resolveOrgImport(segment);
      if (factory) {
        return factory(segment.config);
      }
    }
    onUnknownWrapper?.(segment.name);
    return null;
  }

  // Resolve from registry
  if (registry) {
    const factory = registry.get(segment.name);
    if (factory) {
      return factory(segment.config);
    }
  }

  onUnknownWrapper?.(segment.name);
  return null;
}

/**
 * Synchronous version of composeWrappers
 *
 * Use when all wrappers are already resolved (no org imports)
 */
export function composeWrappersSync(
  segments: PipeSegment[],
  options: Omit<ComposeOptions, "resolveOrgImport"> = {}
): PreviewFn {
  const { registry, basePreview = defaultPreview, onUnknownWrapper } = options;

  if (segments.length === 0) {
    return basePreview;
  }

  const wrappers: Wrapper[] = [];

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];

    if (segment.isOrgImport) {
      // Can't resolve org imports synchronously
      onUnknownWrapper?.(segment.name);
      continue;
    }

    if (registry) {
      const factory = registry.get(segment.name);
      if (factory) {
        wrappers.push(factory(segment.config));
        continue;
      }
    }

    onUnknownWrapper?.(segment.name);
  }

  return wrappers.reduceRight(
    (preview, wrapper) => wrapper(preview),
    basePreview
  );
}

/**
 * Create a wrapper that does nothing (identity wrapper)
 */
export function identityWrapper(): Wrapper {
  return (preview) => preview;
}

/**
 * Create a wrapper from a simple transform function
 */
export function createSimpleWrapper(
  transform: (result: unknown, preview: PreviewFn) => ReturnType<PreviewFn>
): WrapperFactory {
  return () => (preview) => (result, ctx) => transform(result, preview);
}

/**
 * Global wrapper registry
 *
 * Use this for built-in wrappers. Plugins can register additional wrappers.
 */
export const globalRegistry = new MapWrapperRegistry();

/**
 * Register a wrapper in the global registry
 */
export function registerWrapper(name: string, factory: WrapperFactory): void {
  globalRegistry.register(name, factory);
}

/**
 * Get a wrapper from the global registry
 */
export function getWrapper(name: string): WrapperFactory | undefined {
  return globalRegistry.get(name);
}
