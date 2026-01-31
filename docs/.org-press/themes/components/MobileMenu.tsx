import * as React from "react";
import { navSections } from "../navigation.ts";

interface MobileMenuProps {
  currentPath?: string;
}

/**
 * Mobile menu overlay with main navigation
 * Shows all main sections and their items
 */
export function MobileMenu({ currentPath = "/" }: MobileMenuProps) {
  return (
    <div className="mobile-menu">
      <nav className="mobile-menu-nav">
        {navSections.map((section) => (
          <div key={section.title} className="mobile-menu-section">
            <a
              href={section.link}
              className={`mobile-menu-section-title ${
                section.match.test(currentPath) ? "active" : ""
              }`}
            >
              {section.title}
            </a>
            <ul className="mobile-menu-list">
              {section.items.map((item) => (
                <MobileMenuItem
                  key={item.title}
                  item={item}
                  currentPath={currentPath}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mobile-menu-footer">
        <a
          href="https://github.com/org-press/org-press"
          className="mobile-menu-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}

interface MobileMenuItemProps {
  item: { title: string; link?: string; items?: any[] };
  currentPath: string;
  depth?: number;
}

function MobileMenuItem({ item, currentPath, depth = 0 }: MobileMenuItemProps) {
  const isActive = item.link === currentPath;

  if (item.items) {
    return (
      <li className="mobile-menu-group">
        <span className="mobile-menu-group-title">{item.title}</span>
        <ul className="mobile-menu-sublist">
          {item.items.map((subItem) => (
            <MobileMenuItem
              key={subItem.title}
              item={subItem}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <a
        href={item.link}
        className={`mobile-menu-link ${isActive ? "active" : ""}`}
      >
        {item.title}
      </a>
    </li>
  );
}
