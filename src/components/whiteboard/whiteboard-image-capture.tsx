"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";

import type { WhiteboardScene } from "@/lib/whiteboard-scene";

const Tldraw = dynamic(
  () => import("tldraw").then((m) => ({ default: m.Tldraw })),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted grid h-full place-items-center text-xs">
        Завантаження дошки…
      </div>
    ),
  },
);

/**
 * Renders a lesson's saved whiteboard snapshot (read-only, no live sync —
 * just `snapshot` from the persisted `Whiteboard.sceneJson`) purely to
 * capture it as a PNG via `editor.toImageDataUrl()`, the same call the PDF
 * export uses. This is how AI generation "sees" hand-drawn content that
 * `whiteboardToPlainText` can't — that only reads typed text shapes.
 */
export function WhiteboardImageCapture({
  scene,
  onCaptured,
}: {
  scene: WhiteboardScene;
  onCaptured: (dataUrl: string | null) => void;
}) {
  const captured = useRef(false);

  const handleMount = useCallback(
    (editor: Editor) => {
      if (captured.current) return;
      captured.current = true;

      const ids = [...editor.getCurrentPageShapeIds()];
      if (ids.length === 0) {
        onCaptured(null);
        return;
      }
      editor
        .toImageDataUrl(ids, {
          format: "png",
          background: true,
          padding: 24,
          scale: 2,
        })
        .then(({ url }) => onCaptured(url))
        .catch(() => onCaptured(null));
    },
    [onCaptured],
  );

  return (
    <div className="border-line rounded-btn h-32 w-full overflow-hidden border">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tldraw snapshot={scene as any} onMount={handleMount} hideUi />
    </div>
  );
}
