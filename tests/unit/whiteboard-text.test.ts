import { describe, expect, it } from "vitest";

import { whiteboardToPlainText } from "@/lib/whiteboard-text";

describe("whiteboardToPlainText", () => {
  it("pulls text from text/note/geo shape labels and frame names", () => {
    const scene = {
      schema: {},
      store: {
        "shape:1": {
          typeName: "shape",
          type: "text",
          props: {
            richText: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "D = b² − 4ac" }],
                },
              ],
            },
          },
        },
        "shape:2": {
          typeName: "shape",
          type: "note",
          props: { text: "Не забути ±" },
        },
        "shape:3": {
          typeName: "shape",
          type: "frame",
          props: { name: "Крок 1" },
        },
        "shape:4": { typeName: "shape", type: "draw", props: {} },
        "camera:page": { typeName: "camera", x: 0, y: 0 },
      },
    };
    const text = whiteboardToPlainText(scene);
    expect(text).toContain("D = b² − 4ac");
    expect(text).toContain("Не забути ±");
    expect(text).toContain("Крок 1");
  });

  it("returns empty string for the empty-default scene and junk", () => {
    expect(whiteboardToPlainText({})).toBe("");
    expect(whiteboardToPlainText(null)).toBe("");
    expect(whiteboardToPlainText({ store: {} })).toBe("");
  });
});
