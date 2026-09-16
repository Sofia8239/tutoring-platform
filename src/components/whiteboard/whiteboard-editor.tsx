"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSync } from "@tldraw/sync";
import { computed } from "@tldraw/state";
import { createUserId } from "@tldraw/tlschema";
import { Tldraw, type Editor, type TLAssetStore } from "tldraw";
import "tldraw/tldraw.css";

import { env } from "@/lib/env";

export type WhiteboardRole = "teacher" | "student";

type Props = {
  lessonId: string;
  userId: string;
  name: string;
  role: WhiteboardRole;
  /** Hand the live editor to the parent (for PDF export etc.). */
  onReady?: (editor: Editor) => void;
};

// Matches the app's Indigo + Mint palette, so a participant's cursor color
// says "teacher" / "student" at a glance rather than being random-assigned.
const ROLE_COLOR: Record<WhiteboardRole, string> = {
  teacher: "#4F46E5",
  student: "#10B981",
};

/** Stores pasted/dropped images inline as data URLs — no upload backend yet,
 *  same behaviour the solo (pre-multiplayer) editor had. */
const inlineAssetStore: TLAssetStore = {
  upload: async (_asset, file) => {
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(file);
    });
    return { src };
  },
};

/**
 * The tldraw editor, synced live with the lesson's whiteboard room. Loaded
 * via `next/dynamic` with `ssr: false` (tldraw needs `window`).
 *
 * `memo`'d: the canvas — and everything sync-related — must not re-run when
 * an unrelated parent state changes (PDF-export progress, fullscreen), only
 * when its own props actually change. Once mounted, `<Tldraw>` re-renders
 * itself through tldraw's own signal-based reactivity anyway, entirely
 * outside React's render cycle; this just keeps React's side of that quiet.
 */
function WhiteboardEditor({ lessonId, userId, name, role, onReady }: Props) {
  const currentUser = useMemo(
    () =>
      computed("current-user", () => ({
        typeName: "user" as const,
        id: createUserId(userId),
        name,
        color: ROLE_COLOR[role],
        imageUrl: "",
        meta: {},
      })),
    [userId, name, role],
  );

  // `useSync` tears down and reconnects the whole store whenever `users` or
  // `uri` change *by reference* (both sit in its own effect's deps array) —
  // an inline object/closure here would be a new reference on every render,
  // so the sync connection would reset on every render, which is exactly
  // what "flickers, can't draw anything" looks like. Both must stay stable
  // across renders and change only when what they actually depend on does.
  const users = useMemo(() => ({ currentUser }), [currentUser]);

  // Whether *this* student may currently edit — cosmetic only (the banner
  // and the local read-only hint below). The real gate is server-side: the
  // sync room decides `isReadonly` itself, fresh, on every connect; a
  // tampered client claiming `canEdit: true` here can't talk its way into
  // write access. `uri()` re-runs on every (re)connect, so a teacher's
  // toggle — which kicks the student's session — lands here within a beat.
  const [canEdit, setCanEdit] = useState(true);

  const uri = useCallback(async () => {
    const res = await fetch(`/api/lessons/${lessonId}/whiteboard/ticket`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ticket request failed: ${res.status}`);
    const data = (await res.json()) as { ticket: string; canEdit: boolean };
    setCanEdit(data.canEdit);
    return `${env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL}/room/${encodeURIComponent(
      lessonId,
    )}?ticket=${encodeURIComponent(data.ticket)}`;
  }, [lessonId]);

  const store = useSync({ assets: inlineAssetStore, users, uri });

  const editorRef = useRef<Editor | null>(null);
  const isViewOnly = role === "student" && !canEdit;

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      onReady?.(editor);
    },
    [onReady],
  );

  // Applied both at mount and whenever `canEdit` changes later (the editor
  // itself is not remounted on reconnect, so this is what picks up a
  // teacher's toggle for an already-open board) — the local UI half of the
  // read-only state; the connection-level half lives server-side.
  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly: isViewOnly });
  }, [isViewOnly]);

  if (store.status === "loading") {
    return (
      <div className="text-muted grid h-full place-items-center text-sm">
        Підключення до дошки…
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="text-danger grid h-full place-items-center p-4 text-center text-sm">
        Не вдалося підключитися до дошки. Перевірте зʼєднання й перезавантажте
        сторінку.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isViewOnly ? (
        <div className="bg-attention-soft text-attention-strong pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium">
          Вчитель веде — редагування вимкнено
        </div>
      ) : null}
      <Tldraw store={store.store} onMount={handleMount} />
    </div>
  );
}

export default memo(WhiteboardEditor);
