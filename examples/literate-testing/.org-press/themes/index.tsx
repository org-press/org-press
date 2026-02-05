import * as React from "react";
import type { LayoutProps } from "org-press";

/**
 * Simple layout for literate testing example
 */
export function DefaultLayout({ children, metadata }: LayoutProps) {
  const title = metadata.title;
  const date = metadata.date;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title || "Literate Testing Example"}</title>
        <style>{`
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
          }
          pre {
            background: #f5f5f5;
            padding: 1rem;
            overflow-x: auto;
            border-radius: 4px;
          }
          code {
            font-family: ui-monospace, monospace;
          }
        `}</style>
      </head>
      <body>
        {title && <h1>{title}</h1>}
        {date && <p><em>{date}</em></p>}
        <div>{children}</div>
      </body>
    </html>
  );
}

/**
 * Layout registry
 */
export const layouts = {
  default: DefaultLayout,
};

/**
 * Get a layout component by name
 */
export function getLayout(layoutName?: string | null): typeof DefaultLayout {
  if (!layoutName) {
    return layouts.default;
  }

  return layouts[layoutName as keyof typeof layouts] ?? layouts.default;
}
