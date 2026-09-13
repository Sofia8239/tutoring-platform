import { describe, expect, it } from "vitest";

import {
  docByteLength,
  docOrEmpty,
  isTiptapDoc,
  MAX_DOC_BYTES,
  parseIncomingDoc,
} from "@/lib/tiptap-doc";

const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Привіт" }] }],
};

describe("isTiptapDoc", () => {
  it("accepts a doc node", () => {
    expect(isTiptapDoc(doc)).toBe(true);
    expect(isTiptapDoc({ type: "doc" })).toBe(true);
  });

  it("rejects the empty-default and other shapes", () => {
    expect(isTiptapDoc({})).toBe(false);
    expect(isTiptapDoc(null)).toBe(false);
    expect(isTiptapDoc({ type: "paragraph" })).toBe(false);
    expect(isTiptapDoc("<p>x</p>")).toBe(false);
  });
});

describe("docOrEmpty", () => {
  it("passes a doc through and maps junk to an empty doc", () => {
    expect(docOrEmpty(doc)).toBe(doc);
    expect(docOrEmpty({})).toEqual({ type: "doc", content: [] });
    expect(docOrEmpty(null)).toEqual({ type: "doc", content: [] });
  });
});

describe("parseIncomingDoc", () => {
  it("accepts a valid document", () => {
    expect(parseIncomingDoc(doc)).toEqual({ ok: true, doc });
  });

  it("rejects a non-document", () => {
    expect(parseIncomingDoc({ foo: 1 }).ok).toBe(false);
  });

  it("rejects a document over the byte cap", () => {
    const big = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(MAX_DOC_BYTES + 10) }],
        },
      ],
    };
    expect(docByteLength(big)).toBeGreaterThan(MAX_DOC_BYTES);
    expect(parseIncomingDoc(big).ok).toBe(false);
  });
});
