"use client";

import { useMemo } from "react";
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
 */
export default function WhiteboardEditor({
  lessonId,
  userId,
  name,
  role,
  onReady,
}: Props) {
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

  const store = useSync({
    assets: inlineAssetStore,
    users: { currentUser },
    uri: async () => {
      const res = await fetch(`/api/lessons/${lessonId}/whiteboard/ticket`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`ticket request failed: ${res.status}`);
      const { ticket } = (await res.json()) as { ticket: string };
      return `${env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL}/room/${encodeURIComponent(
        lessonId,
      )}?ticket=${encodeURIComponent(ticket)}`;
    },
  });

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

  return <Tldraw store={store.store} onMount={(editor) => onReady?.(editor)} />;
}
