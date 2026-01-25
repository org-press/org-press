import React from "react";
import type { LayoutProps } from "org-press";

/**
 * Custom layout component for the React example
 */
export default function Layout({ title, description, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title || "React Example"}</title>
        {description && <meta name="description" content={description} />}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                line-height: 1.6;
                color: #1a1a2e;
                background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
                min-height: 100vh;
              }

              .layout-container {
                max-width: 900px;
                margin: 0 auto;
                padding: 2rem;
              }

              .layout-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem;
                border-radius: 12px;
                margin-bottom: 2rem;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
              }

              .layout-header h1 {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
              }

              .layout-header p {
                opacity: 0.9;
                font-size: 1.1rem;
              }

              .layout-nav {
                display: flex;
                gap: 1rem;
                margin-top: 1.5rem;
              }

              .layout-nav a {
                color: white;
                text-decoration: none;
                padding: 0.5rem 1rem;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                transition: background 0.2s;
              }

              .layout-nav a:hover {
                background: rgba(255, 255, 255, 0.3);
              }

              .layout-content {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
              }

              .layout-content h1, .layout-content h2, .layout-content h3 {
                color: #1a1a2e;
                margin-top: 1.5rem;
                margin-bottom: 1rem;
              }

              .layout-content h1:first-child {
                margin-top: 0;
              }

              .layout-content p {
                margin-bottom: 1rem;
              }

              .layout-content pre {
                background: #f8f9fa;
                padding: 1rem;
                border-radius: 8px;
                overflow-x: auto;
                margin: 1rem 0;
              }

              .layout-content code {
                font-family: 'Fira Code', 'SF Mono', Consolas, monospace;
                font-size: 0.9rem;
              }

              .layout-footer {
                text-align: center;
                padding: 2rem;
                color: #666;
                font-size: 0.9rem;
              }

              /* React component styling */
              .react-demo {
                border: 2px dashed #667eea;
                border-radius: 8px;
                padding: 1.5rem;
                margin: 1rem 0;
                background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%);
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="layout-container">
          <header className="layout-header">
            <h1>{title || "React Example"}</h1>
            {description && <p>{description}</p>}
            <nav className="layout-nav">
              <a href="/">Home</a>
              <a href="/components">Components</a>
              <a href="/hooks">Hooks</a>
            </nav>
          </header>

          <main className="layout-content">{children}</main>

          <footer className="layout-footer">
            Built with org-press + React
          </footer>
        </div>
      </body>
    </html>
  );
}
