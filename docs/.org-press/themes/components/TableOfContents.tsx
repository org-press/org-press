import * as React from "react";
import type { TocItem } from "org-press";

interface TableOfContentsProps {
  items?: TocItem[];
}

/**
 * Table of Contents component for the right sidebar
 *
 * Displays h2/h3 headings with anchor links.
 * Hidden on mobile and tablet, shown on desktop.
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <aside className="toc">
      <div className="toc-content">
        <h4 className="toc-title">On this page</h4>
        <nav className="toc-nav" aria-label="Table of contents">
          <ul className="toc-list">
            {items.map((item, index) => (
              <TocItemComponent key={index} item={item} />
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

interface TocItemComponentProps {
  item: TocItem;
}

function TocItemComponent({ item }: TocItemComponentProps) {
  const isNested = item.level > 2;

  return (
    <li className={`toc-item ${isNested ? "toc-item-nested" : ""}`}>
      <a href={`#${item.id}`} className="toc-link">
        {item.text}
      </a>
    </li>
  );
}
