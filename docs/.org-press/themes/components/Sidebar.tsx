import * as React from "react";
import {
  navSections,
  getActiveSection,
  isNavItemActive,
  type NavItem,
  type NavSection,
} from "../navigation.ts";

interface SidebarProps {
  currentPath?: string;
}

/**
 * Left sidebar navigation component
 *
 * Displays contextual navigation based on the active top nav section.
 * When "Guide" is selected in top nav, shows Guide items.
 * When "Config" is selected, shows Config items, etc.
 */
export function Sidebar({ currentPath = "/" }: SidebarProps) {
  // Find the active section based on current URL
  const activeSection = getActiveSection(currentPath);

  // Default to first section (Guide) if no match
  const section = activeSection || navSections[0];

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        <nav className="sidebar-nav" aria-label="Section navigation">
          {section && (
            <SidebarSection section={section} currentPath={currentPath} />
          )}
        </nav>
      </div>
    </aside>
  );
}

interface SidebarSectionProps {
  section: NavSection;
  currentPath: string;
}

function SidebarSection({ section, currentPath }: SidebarSectionProps) {
  return (
    <div className="sidebar-section">
      <h3 className="sidebar-section-title">{section.title}</h3>
      <ul className="sidebar-list">
        {section.items.map((item, index) => (
          <SidebarItem key={index} item={item} currentPath={currentPath} />
        ))}
      </ul>
    </div>
  );
}

interface SidebarItemProps {
  item: NavItem;
  currentPath: string;
  depth?: number;
}

function SidebarItem({ item, currentPath, depth = 0 }: SidebarItemProps) {
  const isActive = item.link === currentPath;
  const hasChildren = item.items && item.items.length > 0;
  const isExpanded = hasChildren && isNavItemActive(item, currentPath);

  // If item has no link, it's a group header
  if (!item.link && hasChildren) {
    return (
      <li className="sidebar-group">
        <span className="sidebar-group-title">{item.title}</span>
        <ul className="sidebar-list sidebar-list-nested">
          {item.items!.map((child, index) => (
            <SidebarItem
              key={index}
              item={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li className={`sidebar-item ${isActive ? "active" : ""}`}>
      <a
        href={item.link}
        className={`sidebar-link ${isActive ? "active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        {item.title}
      </a>
      {hasChildren && isExpanded && (
        <ul className="sidebar-list sidebar-list-nested">
          {item.items!.map((child, index) => (
            <SidebarItem
              key={index}
              item={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
