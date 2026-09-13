"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type { Editor } from "tldraw";

import { buttonClass } from "@/components/ui/button";

import type { WhiteboardRole } from "./whiteboard-editor";

const WhiteboardEditor = dynamic(() => import("./whiteboard-editor"), {
  ssr: false,
  loading: () => (
    <div className="text-muted grid h-full place-items-center text-sm">
      Завантаження дошки…
    </div>
  ),
});

type Props = {
  lessonId: string;
  userId: string;
  name: string;
  role: WhiteboardRole;
};

/**
 * A lesson's whiteboard — shared live between the teacher and the student
 * (see `src/jobs/whiteboard-sync-server.ts`). Persistence, presence and
 * reconnect are all handled by the sync layer; this wrapper just adds the
 * app-level chrome (PDF export) around the canvas.
 */
export function WhiteboardCanvas({ lessonId, userId, name, role }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const handleReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const exportPdf = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length === 0) {
      setExportError("Дошка порожня.");
      return;
    }

    setExporting(true);
    setExportError(null);
    try {
      const { url } = await editor.toImageDataUrl(ids, {
        format: "png",
        background: true,
        padding: 24,
        scale: 2,
      });
      const res = await fetch(`/teacher/lessons/${lessonId}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: url }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "Дошка.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setExportError("Не вдалося створити PDF.");
    } finally {
      setExporting(false);
    }
  }, [lessonId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-xs">
          Спільна дошка — зміни бачать і вчитель, і учень одразу.
        </p>
        {role === "teacher" ? (
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting}
            className={buttonClass("secondary", "sm")}
          >
            {exporting ? "Готуємо PDF…" : "Завантажити PDF"}
          </button>
        ) : null}
      </div>

      {exportError ? (
        <p className="text-danger text-xs">{exportError}</p>
      ) : null}

      <div className="border-line rounded-card relative h-[75vh] w-full overflow-hidden border">
        <WhiteboardEditor
          lessonId={lessonId}
          userId={userId}
          name={name}
          role={role}
          onReady={handleReady}
        />
      </div>
    </div>
  );
}
