import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

import { docOrEmpty } from "@/lib/tiptap-doc";
import { pageExtensions } from "@/lib/tiptap-extensions";

/**
 * Render a stored page document to an HTML string on the server — no DOM, no
 * editor instance. Used for the student's read-only view (and, later, PDF).
 */
export function renderPageHtml(contentJson: unknown): string {
  return renderToHTMLString({
    content: docOrEmpty(contentJson),
    extensions: pageExtensions,
  });
}
