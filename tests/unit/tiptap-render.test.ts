import { describe, expect, it } from "vitest";

import { renderPageHtml } from "@/lib/tiptap-render";

describe("renderPageHtml", () => {
  it("renders a paragraph document to HTML", () => {
    const html = renderPageHtml({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Привіт" }] },
      ],
    });
    expect(html).toContain("<p>Привіт</p>");
  });

  it("renders headings and lists", () => {
    const html = renderPageHtml({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Розділ" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "a" }] },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toContain("<h2>Розділ</h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
  });

  it("returns an empty string for the empty-default scene", () => {
    expect(renderPageHtml({})).toBe("");
  });
});
