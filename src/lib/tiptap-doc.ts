import type { JSONContent } from "@tiptap/react";

/**
 * A "page" stores a TipTap / ProseMirror document as JSON (`{ type: "doc",
 * content: [...] }`). Keep the shape checks + size cap in one pure place so the
 * Server Action and the editor agree. (`@tiptap/core` is a type-only import and
 * is DOM-free, so this module is safe in a Server Component.)
 */

export const EMPTY_DOC = { type: "doc", content: [] } as const;

/** Reject documents larger than this once serialised (bytes). */
export const MAX_DOC_BYTES = 1_000_000;

export type TiptapDoc = JSONContent & { type: "doc" };

export function isTiptapDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc"
  );
}

export function docByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

/** DB default is `{}`; treat anything that isn't a doc as an empty document. */
export function docOrEmpty(value: unknown): TiptapDoc {
  return isTiptapDoc(value) ? value : { type: "doc", content: [] };
}

export type ParsedDoc =
  { ok: true; doc: TiptapDoc } | { ok: false; error: string };

export function parseIncomingDoc(value: unknown): ParsedDoc {
  if (!isTiptapDoc(value)) {
    return { ok: false, error: "Некоректний формат сторінки." };
  }
  if (docByteLength(value) > MAX_DOC_BYTES) {
    return { ok: false, error: "Сторінка завелика для збереження." };
  }
  return { ok: true, doc: value };
}
