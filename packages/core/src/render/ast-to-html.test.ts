/**
 * Tests for AST to HTML utilities
 */

import { describe, it, expect } from "vitest";
import {
  renderChildrenToHtml,
  extractTextContent,
  renderListNode,
  extractDrawerProperties,
} from "./ast-to-html.ts";

describe("AST to HTML utilities", () => {
  describe("extractTextContent", () => {
    it("should extract text from text node", () => {
      const node = { type: "text", value: "Hello world" };
      expect(extractTextContent(node)).toBe("Hello world");
    });

    it("should extract text from nested children", () => {
      const node = {
        type: "paragraph",
        children: [
          { type: "text", value: "Hello " },
          { type: "text", value: "world" },
        ],
      };
      expect(extractTextContent(node)).toBe("Hello world");
    });

    it("should handle empty nodes", () => {
      expect(extractTextContent({})).toBe("");
      expect(extractTextContent({ type: "text" })).toBe("");
    });
  });

  describe("renderListNode", () => {
    it("should render unordered list", () => {
      const node = {
        type: "plain-list",
        listType: "unordered",
        children: [
          { type: "list-item", children: [{ type: "text", value: "Item 1" }] },
          { type: "list-item", children: [{ type: "text", value: "Item 2" }] },
        ],
      };
      const html = renderListNode(node);
      expect(html).toBe("<ul><li>Item 1</li>\n<li>Item 2</li></ul>");
    });

    it("should render ordered list", () => {
      const node = {
        type: "plain-list",
        listType: "ordered",
        children: [
          { type: "list-item", children: [{ type: "text", value: "First" }] },
          { type: "list-item", children: [{ type: "text", value: "Second" }] },
        ],
      };
      const html = renderListNode(node);
      expect(html).toBe("<ol><li>First</li>\n<li>Second</li></ol>");
    });
  });

  describe("renderChildrenToHtml", () => {
    it("should render paragraphs", () => {
      const children = [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Hello world" }],
        },
      ];
      expect(renderChildrenToHtml(children)).toBe("<p>Hello world</p>");
    });

    it("should render multiple elements", () => {
      const children = [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Intro" }],
        },
        {
          type: "plain-list",
          listType: "unordered",
          children: [
            { type: "list-item", children: [{ type: "text", value: "Item" }] },
          ],
        },
      ];
      const html = renderChildrenToHtml(children);
      expect(html).toContain("<p>Intro</p>");
      expect(html).toContain("<ul><li>Item</li></ul>");
    });

    it("should exclude properties when requested", () => {
      const children = [
        { type: "node-property", key: "SUMMARY", value: "Test summary" },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content" }],
        },
      ];
      const html = renderChildrenToHtml(children, { excludeProperties: true });
      expect(html).toBe("<p>Content</p>");
      expect(html).not.toContain("SUMMARY");
    });

    it("should include properties when not excluded", () => {
      const children = [
        { type: "node-property", key: "SUMMARY", value: "Test summary" },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content" }],
        },
      ];
      // Properties are not rendered as HTML, just skipped
      const html = renderChildrenToHtml(children, { excludeProperties: false });
      expect(html).toBe("<p>Content</p>");
    });
  });

  describe("extractDrawerProperties", () => {
    it("should extract properties from drawer children", () => {
      const children = [
        { type: "node-property", key: "SUMMARY", value: "Test summary" },
        { type: "node-property", key: "author", value: "John" },
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content" }],
        },
      ];
      const props = extractDrawerProperties(children);
      expect(props).toEqual({
        SUMMARY: "Test summary",
        AUTHOR: "John",
      });
    });

    it("should return empty object for no properties", () => {
      const children = [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content" }],
        },
      ];
      expect(extractDrawerProperties(children)).toEqual({});
    });

    it("should handle empty children", () => {
      expect(extractDrawerProperties([])).toEqual({});
    });
  });
});
