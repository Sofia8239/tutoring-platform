import { isWhiteboardScene } from "@/lib/whiteboard-scene";
import { tiptapToPlainText } from "@/lib/tiptap-text";

/**
 * Pull the readable text out of a tldraw document snapshot: text / note / geo
 * shape labels (`props.richText`, a TipTap-shaped doc), any `props.text`, and
 * frame names. Drawings and formulas without text are not recognised — that is
 * vision territory (Phase 5).
 */
export function whiteboardToPlainText(scene: unknown): string {
  if (!isWhiteboardScene(scene)) return "";

  const parts: string[] = [];
  for (const record of Object.values(scene.store)) {
    if (!record || typeof record !== "object") continue;
    const r = record as {
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (r.typeName !== "shape") continue;

    const props = r.props ?? {};
    if (props.richText) {
      const text = tiptapToPlainText(props.richText);
      if (text) parts.push(text);
    }
    if (typeof props.text === "string" && props.text.trim()) {
      parts.push(props.text.trim());
    }
    if (typeof props.name === "string" && props.name.trim()) {
      parts.push(props.name.trim());
    }
  }

  return parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
