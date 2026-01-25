import * as React from "react";
import type { LayoutProps, TocItem } from "org-press";
import { TopNav } from "./components/TopNav.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { TableOfContents } from "./components/TableOfContents.tsx";
import { Footer } from "./components/Footer.tsx";
import { MobileMenu } from "./components/MobileMenu.tsx";

// Import CSS directly for Vite to process (works in both dev and prod)
import "./default.css";

/**
 * Alpha warning banner shown at the top of all doc pages
 */
function AlphaBanner() {
  return (
    <div className="alpha-banner">
      <span className="alpha-banner-icon">⚠️</span>
      <span className="alpha-banner-text">
        <strong>Early Alpha</strong> — Org-press is experimental.
        Perfect for hackers and tinkerers, not ready for production.
        Documentation may be incomplete or inaccurate.
      </span>
    </div>
  );
}

/**
 * Raw layout - no chrome, just the content
 * Used for custom landing pages with full control
 */
export function RawLayout({ children, metadata, base = "/" }: LayoutProps) {
  const title = metadata.title;
  const description = metadata.description;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} - org-press` : "org-press"}</title>
        {description && <meta name="description" content={description} />}
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "var(--bg-color, #0a0a0f)",
          width: "100%",
        }}
      >
        {children}
        <script
          src="https://analytics.ideable.dev/api/script.js"
          data-site-id="5dc60eeeac5d"
          defer
        />
      </body>
    </html>
  );
}

/**
 * Inline script for mobile menu toggle
 */
const mobileMenuScript = `
(function() {
  document.addEventListener('click', function(e) {
    var button = e.target.closest('.mobile-menu-button');
    if (button) {
      e.stopPropagation();
      document.body.classList.toggle('mobile-menu-open');
      return;
    }
    // Close menu when clicking a link inside the menu
    var menuLink = e.target.closest('.mobile-menu a');
    if (menuLink) {
      document.body.classList.remove('mobile-menu-open');
      return;
    }
    // Close menu when clicking outside
    if (document.body.classList.contains('mobile-menu-open')) {
      var menu = document.querySelector('.mobile-menu');
      if (menu && !menu.contains(e.target)) {
        document.body.classList.remove('mobile-menu-open');
      }
    }
  });
})();
`;

/**
 * Landing layout - header with navigation, no sidebar/TOC
 * Used for landing pages that need nav but custom content area
 */
export function LandingLayout({
  children,
  metadata,
  base = "/",
  currentPath = "/index.html",
}: LayoutProps & { currentPath?: string }) {
  const title = metadata.title;
  const description = metadata.description;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} - org-press` : "org-press"}</title>
        {description && <meta name="description" content={description} />}
        <script dangerouslySetInnerHTML={{ __html: mobileMenuScript }} />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "var(--bg-color, #0a0a0f)",
          width: "100%",
        }}
      >
        <TopNav currentPath={currentPath} />
        <MobileMenu currentPath={currentPath} />
        {children}
        <Footer />
        <script
          src="https://analytics.ideable.dev/api/script.js"
          data-site-id="5dc60eeeac5d"
          defer
        />
      </body>
    </html>
  );
}

/**
 * Documentation layout with Vite-style three-column layout
 *
 * Layout structure:
 * - Header: Logo, top nav (Guide|Config|Plugins|API), GitHub link
 * - Sidebar (left): Contextual navigation for active section
 * - Content (center): Main page content
 * - TOC (right): Table of contents for current page
 */
export function DocLayout({
  children,
  metadata,
  base = "/",
  toc,
  currentPath = "/index.html",
}: LayoutProps & { currentPath?: string }) {
  const title = metadata.title;
  const description = metadata.description;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} | org-press` : "org-press"}</title>
        {description && <meta name="description" content={description} />}
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        {/* Highlight.js for syntax highlighting */}
        <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
        {/* GitHub Dark theme for highlight.js - respects prefers-color-scheme */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
          media="(prefers-color-scheme: dark)"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          // Register org-mode language for highlight.js
          if (typeof hljs !== 'undefined') {
            hljs.registerLanguage('org', function(hljs) {
              return {
                name: 'Org',
                aliases: ['org', 'org-mode', 'orgmode'],
                case_insensitive: true,
                contains: [
                  // Headlines
                  {
                    className: 'section',
                    begin: /^\\*+\\s/,
                    end: /$/,
                    contains: [
                      { className: 'keyword', begin: /\\b(TODO|DONE|WAITING|CANCELLED|NEXT|HOLD)\\b/ }
                    ]
                  },
                  // Keywords (#+KEYWORD:)
                  {
                    className: 'meta',
                    begin: /^#\\+[A-Za-z_]+:/,
                    end: /$/,
                    contains: [{ className: 'string', begin: /\\s/, end: /$/ }]
                  },
                  // Begin/end blocks
                  { className: 'keyword', begin: /^#\\+(begin|end)_[a-z]+/i, relevance: 10 },
                  // Property drawers
                  { className: 'attribute', begin: /^:\\w+:/, end: /$/ },
                  // Links [[url][description]]
                  {
                    className: 'link',
                    begin: /\\[\\[/,
                    end: /\\]\\]/,
                    contains: [{ className: 'string', begin: /\\]\\[/, end: /(?=\\]\\])/ }]
                  },
                  // Comments (lines starting with #, but not #+)
                  { className: 'comment', begin: /^#[^+]/, end: /$/ },
                  // Timestamps
                  { className: 'number', begin: /<\\d{4}-\\d{2}-\\d{2}/, end: />/ },
                  // Tags :tag1:tag2:
                  { className: 'tag', begin: /\\s:[a-zA-Z0-9_@#%:]+:\\s*$/ }
                ]
              };
            });
            // Run highlighting after DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
              hljs.highlightAll();
            });
          }
        `,
          }}
        />
        {/* Inline script for mobile menu and active states */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            // Set current path as data attribute for CSS styling
            document.documentElement.dataset.path = window.location.pathname;

            // Mobile menu toggle using event delegation
            document.addEventListener('click', function(e) {
              var button = e.target.closest('.mobile-menu-button');
              if (button) {
                e.stopPropagation();
                document.body.classList.toggle('mobile-menu-open');
                return;
              }
              // Close menu when clicking a link inside the menu
              var menuLink = e.target.closest('.mobile-menu a');
              if (menuLink) {
                document.body.classList.remove('mobile-menu-open');
                return;
              }
              // Close menu when clicking outside
              if (document.body.classList.contains('mobile-menu-open')) {
                var menu = document.querySelector('.mobile-menu');
                if (menu && !menu.contains(e.target)) {
                  document.body.classList.remove('mobile-menu-open');
                }
              }
            });

            // Highlight current page in navigation
            document.addEventListener('DOMContentLoaded', function() {
              var path = window.location.pathname;
              // Highlight sidebar links
              document.querySelectorAll('.sidebar-link').forEach(function(link) {
                if (link.getAttribute('href') === path) {
                  link.classList.add('active');
                  link.closest('.sidebar-item')?.classList.add('active');
                }
              });
              // Highlight top nav links
              document.querySelectorAll('.top-nav-link').forEach(function(link) {
                var href = link.getAttribute('href');
                var match = link.dataset.match;
                if (path === href || (match && path.startsWith(match))) {
                  link.classList.add('active');
                }
              });
            });
          })();
        `,
          }}
        />
      </head>
      <body>
        <div className="docs-layout">
          <TopNav currentPath={currentPath} />
          <MobileMenu currentPath={currentPath} />
          <AlphaBanner />

          <div className="docs-container">
            <Sidebar currentPath={currentPath} />

            <main className="docs-content">
              <article className="docs-article">
                <div className="docs-body">{children}</div>
              </article>
            </main>

            <TableOfContents items={toc} />
          </div>

          <Footer />
        </div>
        <script
          src="https://analytics.ideable.dev/api/script.js"
          data-site-id="5dc60eeeac5d"
          defer
        />
      </body>
    </html>
  );
}

/**
 * Layout registry
 */
export const layouts = {
  default: DocLayout,
  doc: DocLayout,
  raw: RawLayout,
  landing: LandingLayout,
};

/**
 * Get a layout component by name
 */
export function getLayout(layoutName?: string | null): typeof DocLayout {
  if (!layoutName) {
    return layouts.default;
  }

  return layouts[layoutName as keyof typeof layouts] ?? layouts.default;
}
