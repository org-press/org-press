/**
 * Default Layout for Org-Press 2
 *
 * Minimal, clean HTML structure for sites without custom themes.
 * Provides:
 * - Semantic HTML
 * - Responsive viewport
 * - Basic styling
 * - Accessibility features
 */

import type { LayoutProps } from "../../render/types.ts";

// Import CSS - Vite will handle bundling this
import "./index.css";

/**
 * Default layout component
 *
 * @param props - Layout props
 * @returns HTML structure
 */
export default function DefaultLayout({
  children,
  metadata,
  base,
}: LayoutProps) {
  const title = metadata.title || "Org-Press";
  const description = metadata.description;
  const author = metadata.author;
  const date = metadata.date;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>

        {description && <meta name="description" content={description} />}
        {author && <meta name="author" content={author} />}
        {date && <meta name="date" content={date} />}

        {base && base !== "/" && <base href={base} />}
      </head>
      <body>
        <div className="layout-container">
          <header className="site-header">
            <nav className="site-nav">
              <a href="/" className="site-title">
                {metadata.siteTitle || "Org-Press"}
              </a>
              <ul className="nav-links">
                <li>
                  <a href="/">Home</a>
                </li>
              </ul>
            </nav>
          </header>

          <main className="site-main">
            <article className="content">
              {metadata.title && <h1 className="page-title">{metadata.title}</h1>}

              {(date || author) && (
                <div className="page-meta">
                  {date && (
                    <time className="page-date" dateTime={date}>
                      {formatDate(date)}
                    </time>
                  )}
                  {author && <span className="page-author">by {author}</span>}
                </div>
              )}

              <div className="page-content">{children}</div>
            </article>
          </main>

          <footer className="site-footer">
            <p>Powered by <a href="https://github.com/org-press/org-press">Org-Press</a></p>
          </footer>
        </div>
      </body>
    </html>
  );
}

/**
 * Format date for display
 *
 * @param dateStr - Date string (YYYY-MM-DD or ISO format)
 * @returns Formatted date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
