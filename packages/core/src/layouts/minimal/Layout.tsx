/**
 * Minimal Layout for Org-Press Single-File Mode
 *
 * A clean, minimal layout without header, footer, or navigation.
 * Ideal for single-file hashbang mode and standalone pages.
 *
 * Features:
 * - No header/footer/navigation
 * - Clean content presentation
 * - Responsive viewport
 * - Basic typography
 */

import type { LayoutProps } from "../../render/types.ts";

// Import shared styles for content rendering
import "../default/css/styles.css";
import "../default/css/org.css";
import "../default/css/src.css";

/**
 * Minimal layout component
 *
 * @param props - Layout props
 * @returns HTML structure
 */
export default function MinimalLayout({
  children,
  metadata,
  base,
}: LayoutProps) {
  const title = metadata.title || "Org-Press";
  const description = metadata.description;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>

        {description && <meta name="description" content={description} />}
        {base && base !== "/" && <base href={base} />}

        <style>{`
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 50rem;
            margin: 0 auto;
            padding: 2rem 1rem;
            color: #1a1a1a;
            background: #fff;
          }
          @media (prefers-color-scheme: dark) {
            body {
              color: #e5e5e5;
              background: #1a1a1a;
            }
          }
          h1 { margin-top: 0; }
        `}</style>
      </head>
      <body>
        <main>
          {metadata.title && <h1>{metadata.title}</h1>}
          {children}
        </main>

        <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #eee", fontSize: "0.875rem", color: "#666" }}>
          <p>
            Powered by{" "}
            <a href="https://github.com/org-press/org-press">Org-Press</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
