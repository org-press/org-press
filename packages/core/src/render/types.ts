import type { OrgData } from "uniorg";
import type { PageMetadata } from "../config/types.ts";

/**
 * Render layer types
 *
 * The render layer converts AST to HTML and applies layouts.
 * It receives AST and returns HTML - no file I/O, no build concerns.
 */

/**
 * Context provided to render functions
 *
 * Contains all necessary information for rendering without file I/O.
 */
export interface RenderContext {
  /** Base URL path for the site */
  base: string;

  /** Page metadata */
  metadata: PageMetadata;

  /** Layout to use (if specified) */
  layout?: string;

  /** Environment mode */
  mode?: "development" | "production";
}

/**
 * Layout component props
 *
 * Props passed to React layout components during SSR.
 */
export interface LayoutProps {
  /** Rendered HTML content */
  children: React.ReactNode;

  /** Page metadata from org-mode keywords */
  metadata: PageMetadata;

  /** Base URL path */
  base: string;

  /** Table of contents extracted from headings */
  toc?: TocItem[];

  /** Additional props for layout customization */
  [key: string]: any;
}

/**
 * Layout component type
 */
export type LayoutComponent = React.ComponentType<LayoutProps>;

/**
 * Layout map (name → component)
 */
export type LayoutMap = Record<string, LayoutComponent>;

/**
 * Table of contents item extracted from headings
 */
export interface TocItem {
  /** Heading ID (used for anchor links) */
  id: string;

  /** Heading text content */
  text: string;

  /** Heading level (2 for h2, 3 for h3, etc.) */
  level: number;
}

/**
 * Result of rendering
 */
export interface RenderResult {
  /** Rendered HTML */
  html: string;

  /** Metadata used during rendering */
  metadata: PageMetadata;

  /** Table of contents extracted from headings */
  toc?: TocItem[];
}

/**
 * SSR render options
 */
export interface SSRRenderOptions {
  /** AST to render */
  ast: OrgData;

  /** Render context */
  context: RenderContext;

  /** Layout component to use */
  Layout?: LayoutComponent;

  /** Additional props for layout */
  layoutProps?: Record<string, any>;
}

/**
 * Full page render options
 */
export interface PageRenderOptions {
  /** Rendered body HTML */
  bodyHtml: string;

  /** Page metadata */
  metadata: PageMetadata;

  /** Base URL path */
  base: string;

  /** Scripts to inject */
  scripts?: string[];

  /** Styles to inject */
  styles?: string[];

  /** Additional head content */
  head?: string;
}
