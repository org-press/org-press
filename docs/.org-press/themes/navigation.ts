/**
 * Navigation structure for Vite-style docs layout
 *
 * Top navigation sections with contextual sidebar items.
 * Sidebar shows items for the currently active top nav section.
 */

export interface NavItem {
  title: string;
  link?: string;
  items?: NavItem[];
}

export interface NavSection {
  title: string;
  link: string;
  match: RegExp; // Pattern to match URLs for this section
  items: NavItem[];
}

/**
 * Top navigation sections
 * Each section has contextual sidebar items that appear when active
 */
export const navSections: NavSection[] = [
  {
    title: "Guide",
    link: "/guide/index.html",
    match: /^\/(guide(\/|$)|getting-started|index\.html$)/,
    items: [
      { title: "What is Org-Press?", link: "/guide/index.html" },
      { title: "Getting Started", link: "/guide/getting-started.html" },
      { title: "Why Org-Press?", link: "/guide/why-org-press.html" },
      { title: "Features", link: "/guide/features.html" },
      { title: "CLI Reference", link: "/guide/cli.html" },
      { title: "Using Plugins", link: "/guide/using-plugins.html" },
      { title: "Block Imports", link: "/guide/block-imports.html" },
      { title: "Static Assets", link: "/guide/static-assets.html" },
      { title: "Building for Production", link: "/guide/building.html" },
      { title: "Deploying", link: "/guide/deploying.html" },
      { title: "Troubleshooting", link: "/guide/troubleshooting.html" },
    ],
  },
  {
    title: "Config",
    link: "/config/index.html",
    match: /^\/config(\/|$)/,
    items: [
      { title: "Overview", link: "/config/index.html" },
      { title: "Shared Options", link: "/config/shared-options.html" },
      { title: "Build Options", link: "/config/build-options.html" },
      { title: "Server Options", link: "/config/server-options.html" },
      { title: "Plugin Options", link: "/config/plugin-options.html" },
    ],
  },
  {
    title: "Plugins",
    link: "/plugins/index.html",
    match: /^\/plugins(\/|$)/,
    items: [
      { title: "Overview", link: "/plugins/index.html" },
      {
        title: "Official Plugins",
        items: [
          { title: "ECharts", link: "/plugins/echarts.html" },
          { title: "Excalidraw", link: "/plugins/excalidraw.html" },
          { title: "JSCAD", link: "/plugins/jscad.html" },
          { title: "Test", link: "/plugins/test.html" },
        ],
      },
      { title: "Creating Plugins", link: "/plugins/creating-plugins.html" },
    ],
  },
  {
    title: "API",
    link: "/api/index.html",
    match: /^\/api(\/|$)/,
    items: [
      { title: "Overview", link: "/api/index.html" },
      { title: "Plugin API", link: "/api/plugin-api.html" },
      { title: "JavaScript API", link: "/api/javascript-api.html" },
      { title: "HMR API", link: "/api/hmr-api.html" },
      { title: "CLI Plugins", link: "/api/cli-plugins.html" },
    ],
  },
];

/**
 * Get the active nav section based on current URL path
 */
export function getActiveSection(pathname: string): NavSection | undefined {
  // Normalize pathname
  const normalizedPath = pathname || "/index.html";

  // Find the section that matches the current path
  for (const section of navSections) {
    if (section.match.test(normalizedPath)) {
      return section;
    }
  }

  // Default to first section (Guide)
  return navSections[0];
}

/**
 * Check if a nav item is active (current page or parent of current page)
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.link === pathname) return true;
  if (item.items) {
    return item.items.some((child) => isNavItemActive(child, pathname));
  }
  return false;
}

/**
 * Get section for a given page path (used during SSR)
 */
export function getSectionForPath(pathname: string): NavSection {
  return getActiveSection(pathname) || navSections[0];
}
