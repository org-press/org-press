import * as React from "react";

/**
 * Site footer with sitemap navigation
 * Used across all page layouts
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-grid">
          {/* Guide */}
          <div className="footer-column">
            <h4>Guide</h4>
            <ul>
              <li><a href="/guide/index.html">What is Org-Press?</a></li>
              <li><a href="/guide/getting-started.html">Getting Started</a></li>
              <li><a href="/guide/features.html">Features</a></li>
              <li><a href="/guide/cli.html">CLI Reference</a></li>
              <li><a href="/guide/building.html">Building</a></li>
            </ul>
          </div>

          {/* Config */}
          <div className="footer-column">
            <h4>Config</h4>
            <ul>
              <li><a href="/config/index.html">Overview</a></li>
              <li><a href="/config/shared-options.html">Shared Options</a></li>
              <li><a href="/config/build-options.html">Build Options</a></li>
              <li><a href="/config/server-options.html">Server Options</a></li>
            </ul>
          </div>

          {/* Plugins */}
          <div className="footer-column">
            <h4>Plugins</h4>
            <ul>
              <li><a href="/plugins/index.html">Overview</a></li>
              <li><a href="/plugins/excalidraw.html">Excalidraw</a></li>
              <li><a href="/plugins/jscad.html">JSCAD</a></li>
              <li><a href="/plugins/creating-plugins.html">Creating Plugins</a></li>
            </ul>
          </div>

          {/* API */}
          <div className="footer-column">
            <h4>API</h4>
            <ul>
              <li><a href="/api/index.html">Overview</a></li>
              <li><a href="/api/plugin-api.html">Plugin API</a></li>
              <li><a href="/api/javascript-api.html">JavaScript API</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="footer-column">
            <h4>Resources</h4>
            <ul>
              <li><a href="/examples/index.html">Examples</a></li>
              <li><a href="https://github.com/org-press/org-press" target="_blank" rel="noopener">GitHub</a></li>
              <li><a href="https://github.com/org-press/org-press/releases" target="_blank" rel="noopener">Releases</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            Released under the GPL-2.0 License.
          </p>
          <p className="footer-credit">
            Built with <a href="https://github.com/org-press/org-press">org-press</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
