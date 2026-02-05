import * as React from "react";
import { navSections, type NavSection } from "../navigation.ts";

interface TopNavProps {
  currentPath?: string;
  sourceRepo?: string;
}

/**
 * Convert HTML path to org source path for GitHub
 * /plugins/echarts.html → docs/content/plugins/echarts.org
 * /guide/index.html → docs/content/guide/index.org
 */
function getSourceUrl(currentPath: string, repo: string): string | null {
  // Skip non-content paths
  if (!currentPath || currentPath === "/" || currentPath === "/index.html") {
    return `${repo}/blob/main/docs/content/index.org?plain=1`;
  }

  // Remove leading slash and .html extension
  let orgPath = currentPath.replace(/^\//, "").replace(/\.html$/, "");

  // Handle section index pages: /guide → guide/index, /config → config/index
  // These directories have index.org files, not guide.org
  const sectionDirs = ["guide", "config", "plugins", "api", "examples"];
  for (const dir of sectionDirs) {
    if (orgPath === dir) {
      orgPath = `${dir}/index`;
    }
  }

  // Add .org extension
  orgPath = `${orgPath}.org`;

  return `${repo}/blob/main/docs/content/${orgPath}?plain=1`;
}

/**
 * Top navigation component with main section links
 *
 * Displays: [Logo]  [Guide|Config|Plugins|API]  [GitHub]
 */
export function TopNav({
  currentPath = "/",
  sourceRepo = "https://github.com/org-press/org-press"
}: TopNavProps) {
  const sourceUrl = getSourceUrl(currentPath, sourceRepo);

  return (
    <header className="top-nav">
      <div className="top-nav-container">
        {/* Logo */}
        <a href="/index.html" className="top-nav-logo">
          <span className="logo-text">Org-Press</span>
        </a>

        {/* Main nav links */}
        <nav className="top-nav-links">
          {navSections.map((section) => (
            <TopNavLink
              key={section.title}
              section={section}
              currentPath={currentPath}
            />
          ))}
        </nav>

        {/* Right side links */}
        <div className="top-nav-social">
          {sourceUrl && (
            <a
              href={sourceUrl}
              className="top-nav-source-link"
              target="_blank"
              rel="noopener noreferrer"
              title="View page source on GitHub"
            >
              :view-source
            </a>
          )}
          <a
            href={sourceRepo}
            className="top-nav-social-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
        </div>

        {/* Mobile hamburger - click handler added via inline script in DocLayout */}
        <button
          className="mobile-menu-button"
          aria-label="Toggle navigation menu"
          aria-expanded="false"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      </div>
    </header>
  );
}

interface TopNavLinkProps {
  section: NavSection;
  currentPath: string;
}

function TopNavLink({ section, currentPath }: TopNavLinkProps) {
  const isActive =
    section.match.test(currentPath) ||
    currentPath === section.link ||
    section.items.some(
      (item) =>
        item.link === currentPath ||
        item.items?.some((child) => child.link === currentPath)
    );

  return (
    <a
      href={section.link}
      className={`top-nav-link ${isActive ? "active" : ""}`}
      data-match={section.match.source}
    >
      {section.title}
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
