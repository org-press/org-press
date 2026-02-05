/**
 * Test Results Wrapper Component
 *
 * Renders test results inline in the document with a summary bar,
 * individual test statuses, and expandable error details.
 */

import type { TestBlockResult, TestResult, CoverageData } from "./types.ts";

/** Configuration for the test results renderer */
interface RenderConfig {
  blockId: string;
  blockName?: string;
  showCoverage: boolean;
  orgFilePath: string;
  blockIndex: number;
}

/** Styles for the test results UI */
const styles = `
.test-results {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  overflow: hidden;
  margin: 1em 0;
}

.test-results-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f6f8fa;
  border-bottom: 1px solid #e1e4e8;
}

.test-results-summary.all-pass {
  background: #dcffe4;
  border-bottom-color: #34d058;
}

.test-results-summary.has-fail {
  background: #ffeef0;
  border-bottom-color: #d73a49;
}

.test-results-summary.pending {
  background: #fff8c5;
  border-bottom-color: #f9c513;
}

.test-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.test-badge.pass {
  background: #dcffe4;
  color: #22863a;
}

.test-badge.fail {
  background: #ffeef0;
  color: #cb2431;
}

.test-badge.skip {
  background: #f1f8ff;
  color: #0366d6;
}

.test-duration {
  color: #6a737d;
  font-size: 12px;
  margin-left: auto;
}

.test-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.test-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 16px;
  border-bottom: 1px solid #e1e4e8;
}

.test-item:last-child {
  border-bottom: none;
}

.test-item.pass {
  background: #fff;
}

.test-item.fail {
  background: #ffeef0;
}

.test-item.skip {
  background: #f6f8fa;
}

.test-status-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}

.test-status-icon.pass {
  color: #22863a;
}

.test-status-icon.fail {
  color: #cb2431;
}

.test-status-icon.skip {
  color: #6a737d;
}

.test-name {
  flex: 1;
  word-break: break-word;
}

.test-item-duration {
  color: #6a737d;
  font-size: 12px;
  margin-left: 8px;
}

.test-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: #1b1f23;
  color: #f97583;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
}

.test-error-expected {
  color: #85e89d;
}

.test-error-actual {
  color: #f97583;
}

.coverage-section {
  padding: 12px 16px;
  background: #f6f8fa;
  border-top: 1px solid #e1e4e8;
}

.coverage-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.coverage-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coverage-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coverage-label {
  width: 70px;
  font-size: 12px;
  color: #6a737d;
}

.coverage-track {
  flex: 1;
  height: 8px;
  background: #e1e4e8;
  border-radius: 4px;
  overflow: hidden;
}

.coverage-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.coverage-fill.high {
  background: #34d058;
}

.coverage-fill.medium {
  background: #f9c513;
}

.coverage-fill.low {
  background: #d73a49;
}

.coverage-percent {
  width: 45px;
  text-align: right;
  font-size: 12px;
  font-weight: 500;
}

.test-pending-message {
  padding: 24px;
  text-align: center;
  color: #6a737d;
}

.test-pending-message code {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: inherit;
}
`;

/**
 * Create an SVG icon for test status
 */
function createStatusIcon(status: "pass" | "fail" | "skip"): string {
  if (status === "pass") {
    return `<svg class="test-status-icon pass" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
    </svg>`;
  } else if (status === "fail") {
    return `<svg class="test-status-icon fail" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
    </svg>`;
  } else {
    return `<svg class="test-status-icon skip" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>`;
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Render a single test item
 */
function renderTestItem(test: TestResult): string {
  const errorHtml = test.error
    ? `<div class="test-error">
        ${escapeHtml(test.error.message)}
        ${test.error.expected !== undefined ? `\n\n<span class="test-error-expected">Expected: ${escapeHtml(String(test.error.expected))}</span>` : ""}
        ${test.error.actual !== undefined ? `\n<span class="test-error-actual">Actual: ${escapeHtml(String(test.error.actual))}</span>` : ""}
      </div>`
    : "";

  return `
    <li class="test-item ${test.status}">
      ${createStatusIcon(test.status)}
      <span class="test-name">${escapeHtml(test.name)}</span>
      <span class="test-item-duration">${formatDuration(test.duration)}</span>
      ${errorHtml}
    </li>
  `;
}

/**
 * Render coverage data
 */
function renderCoverage(coverage: CoverageData): string {
  const metrics = [
    { label: "Lines", data: coverage.lines },
    { label: "Functions", data: coverage.functions },
    ...(coverage.branches ? [{ label: "Branches", data: coverage.branches }] : []),
    ...(coverage.statements ? [{ label: "Statements", data: coverage.statements }] : []),
  ];

  return `
    <div class="coverage-section">
      <div class="coverage-title">Coverage</div>
      <div class="coverage-bars">
        ${metrics
          .map(
            ({ label, data }) => `
          <div class="coverage-bar">
            <span class="coverage-label">${label}</span>
            <div class="coverage-track">
              <div
                class="coverage-fill ${data.percent >= 80 ? "high" : data.percent >= 50 ? "medium" : "low"}"
                style="width: ${data.percent}%"
              ></div>
            </div>
            <span class="coverage-percent">${data.percent.toFixed(1)}%</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Render test results into a container element
 *
 * @param container - DOM element to render into
 * @param results - Test results (or null if not yet available)
 * @param config - Render configuration
 */
export default function renderTestResults(
  container: HTMLElement,
  results: TestBlockResult | null,
  config: RenderConfig
): void {
  // Inject styles if not already present
  if (!document.getElementById("test-results-styles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "test-results-styles";
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render pending state if no results
  if (!results) {
    container.innerHTML = `
      <div class="test-results">
        <div class="test-results-summary pending">
          <span class="test-badge skip">Pending</span>
          <span>Tests not yet run</span>
        </div>
        <div class="test-pending-message">
          Run <code>orgp test</code> to execute tests and see results here.
        </div>
      </div>
    `;
    return;
  }

  const passed = results.tests.filter((t) => t.status === "pass").length;
  const failed = results.tests.filter((t) => t.status === "fail").length;
  const skipped = results.tests.filter((t) => t.status === "skip").length;

  const summaryClass =
    failed > 0 ? "has-fail" : passed > 0 ? "all-pass" : "pending";

  const html = `
    <div class="test-results">
      <div class="test-results-summary ${summaryClass}">
        ${passed > 0 ? `<span class="test-badge pass">${passed} passed</span>` : ""}
        ${failed > 0 ? `<span class="test-badge fail">${failed} failed</span>` : ""}
        ${skipped > 0 ? `<span class="test-badge skip">${skipped} skipped</span>` : ""}
        <span class="test-duration">${formatDuration(results.duration)}</span>
      </div>
      <ul class="test-list">
        ${results.tests.map(renderTestItem).join("")}
      </ul>
      ${config.showCoverage && results.coverage ? renderCoverage(results.coverage) : ""}
    </div>
  `;

  container.innerHTML = html;
}
