import { describe, expect, it } from "vitest";

import { tiptapToPlainText } from "@/lib/tiptap-text";

describe("tiptapToPlainText", () => {
  it("flattens headings, paragraphs and lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Тема" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Вступ." }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "a" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "b" }] },
              ],
            },
          ],
        },
      ],
    };
    const text = tiptapToPlainText(doc);
    expect(text).toContain("Тема");
    expect(text).toContain("Вступ.");
    expect(text).toContain("- a");
    expect(text).toContain("- b");
  });

  it("joins table cells with a pipe", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "D" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "корені" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToPlainText(doc)).toContain("D | корені");
  });

  it("returns empty string for non-doc input", () => {
    expect(tiptapToPlainText({})).toBe("");
    expect(tiptapToPlainText(null)).toBe("");
    expect(tiptapToPlainText("text")).toBe("");
  });

  it("collapses excessive blank lines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "A" }] },
        { type: "heading", content: [{ type: "text", text: "B" }] },
      ],
    };
    expect(tiptapToPlainText(doc)).not.toMatch(/\n{3,}/);
  });
});
