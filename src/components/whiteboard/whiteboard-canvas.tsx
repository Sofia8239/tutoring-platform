"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";

import { buttonClass } from "@/components/ui/button";
import type { ToggleCanEditState } from "@/app/(app)/teacher/lessons/[lessonId]/whiteboard/actions";

import { WhiteboardPermissionToggle } from "./whiteboard-permission-toggle";

const WhiteboardEditor = dynamic(() => import("./whiteboard-editor"), {
  ssr: false,
  loading: () => (
    <div className="text-muted grid h-full place-items-center text-sm">
      Завантаження дошки…
    </div>
  ),
});

type ToggleAction = (
  prev: ToggleCanEditState,
  formData: FormData,
) => Promise<ToggleCanEditState>;

type Props = { lessonId: string; userId: string; name: string } & (
  | { role: "teacher"; initialCanEdit: boolean; toggleAction: ToggleAction }
  | { role: "student" }
);

/**
 * A lesson's whiteboard — shared live between the teacher and the student
 * (see `src/jobs/whiteboard-sync-server.ts`). Persistence, presence and
 * reconnect are all handled by the sync layer; this wrapper just adds the
 * app-level chrome (fullscreen, PDF export) around the canvas.
 */
export function WhiteboardCanvas(props: Props) {
  const { lessonId, userId, name, role } = props;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // --- Fullscreen -----------------------------------------------------
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Starts `false` on both server and client render — `document` doesn't
  // exist during SSR, so computing this eagerly (even via a lazy `useState`
  // initializer, which still runs during the client's hydration pass) would
  // disagree with the server-rendered HTML and trigger a hydration mismatch.
  // Detecting it in an effect defers the check until after hydration, when
  // client and server are no longer being compared.
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    // iOS Safari has no Fullscreen API for arbitrary elements — this hides
    // the button there rather than offering something that would just no-op.
    // One-time post-hydration capability check, not state synced from
    // props/state, so the cascading-render concern this rule guards against
    // doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFullscreenSupported(document.fullscreenEnabled);

    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      // Esc (or the browser's own exit control) fires `fullscreenchange`
      // too, so that's the only place `isFullscreen` needs to be set.
      void containerRef.current?.requestFullscreen().catch(() => {
        /* denied / unsupported on this device — button stays as-is */
      });
    }
  }, []);

  // --- PDF export -------------------------------------------------------
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
        {role === "teacher" ? (
          <WhiteboardPermissionToggle
            lessonId={lessonId}
            initialCanEdit={props.initialCanEdit}
            toggleAction={props.toggleAction}
          />
        ) : (
          <p className="text-muted text-xs">
            Спільна дошка — зміни бачать і вчитель, і учень одразу.
          </p>
        )}
        <div className="flex items-center gap-2">
          {fullscreenSupported ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className={buttonClass("secondary", "sm")}
            >
              {isFullscreen ? "Вийти з повного екрана" : "На весь екран"}
            </button>
          ) : null}
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
      </div>

      {exportError ? (
        <p className="text-danger text-xs">{exportError}</p>
      ) : null}

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? "bg-surface relative h-full w-full overflow-hidden"
            : "border-line rounded-card relative h-[75vh] w-full overflow-hidden border"
        }
      >
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
