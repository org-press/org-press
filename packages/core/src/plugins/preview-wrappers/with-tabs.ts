/**
 * withTabs Wrapper
 *
 * Displays source code and render result in a tabbed interface.
 * Users can switch between "Result" and "Source" tabs.
 */

import type { WrapperFactory, RenderFunction, RenderResult, BlockContext } from "../preview.ts";

export interface WithTabsConfig {
  /** Label for the result tab */
  resultLabel?: string;

  /** Label for the source tab */
  sourceLabel?: string;

  /** Which tab to show first: result or source */
  defaultTab?: "result" | "source";

  /** CSS class for the tabs container */
  className?: string;
}

/**
 * Creates a wrapper that displays source code and result in tabs
 *
 * @example
 * ```org
 * #+begin_src javascript :use dom | withTabs
 * // Interactive component
 * #+end_src
 *
 * #+begin_src javascript :use dom | withTabs?defaultTab=source
 * // Show source first
 * #+end_src
 * ```
 */
export const withTabs: WrapperFactory = (config?: Record<string, unknown>) => {
  const {
    resultLabel = "Result",
    sourceLabel = "Source",
    defaultTab = "result",
    className = "org-tabs",
  } = (config ?? {}) as WithTabsConfig;

  return (render: RenderFunction): RenderFunction => {
    return (result: unknown, ctx: BlockContext): RenderResult => {
      const renderResult = render(result, ctx);
      const renderHtml = typeof renderResult === "string" ? renderResult : "";

      const tabId = `tabs-${Math.random().toString(36).slice(2, 9)}`;
      const resultActive = defaultTab === "result";

      return `<div class="${className}" data-tabs-id="${tabId}">
  <div class="org-tabs-header">
    <button class="org-tab${resultActive ? " active" : ""}" data-tab="result" type="button">${resultLabel}</button>
    <button class="org-tab${!resultActive ? " active" : ""}" data-tab="source" type="button">${sourceLabel}</button>
  </div>
  <div class="org-tabs-content">
    <div class="org-tab-panel${resultActive ? " active" : ""}" data-panel="result">
      ${renderHtml}
    </div>
    <div class="org-tab-panel${!resultActive ? " active" : ""}" data-panel="source">
      <pre class="org-source-pre"><code class="language-${ctx.block.language}">${escapeHtml(ctx.block.content)}</code></pre>
    </div>
  </div>
</div>
<script type="module">
(function() {
  const container = document.querySelector('[data-tabs-id="${tabId}"]');
  if (!container) return;
  const tabs = container.querySelectorAll('.org-tab');
  const panels = container.querySelectorAll('.org-tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === target));
    });
  });
})();
</script>`;
    };
  };
};

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
