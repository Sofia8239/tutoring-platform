import type { JSONContent } from "@tiptap/react";

/**
 * Flatten a TipTap document to plain text for feeding an LLM. Headings get a
 * blank line before them, list items get a "- " prefix, table rows join cells
 * with " | ". Pure — no editor, no DOM.
 */

function nodeText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";

  const children = (node.content ?? []).map(nodeText);

  switch (node.type) {
    case "heading":
      return `\n${children.join("")}\n`;
    case "paragraph":
      return `${children.join("")}\n`;
    case "listItem":
    case "taskItem":
      return `- ${children.join("").trim()}\n`;
    case "codeBlock":
      return `\n${children.join("")}\n`;
    case "hardBreak":
      return "\n";
    case "horizontalRule":
      return "\n---\n";
    case "tableRow":
      return `${(node.content ?? [])
        .map((cell) => nodeText(cell).trim())
        .join(" | ")}\n`;
    default:
      return children.join("");
  }
}

export function tiptapToPlainText(doc: unknown): string {
  if (
    typeof doc !== "object" ||
    doc === null ||
    (doc as JSONContent).type !== "doc"
  ) {
    return "";
  }
  return nodeText(doc as JSONContent)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
