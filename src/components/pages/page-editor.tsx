"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { pageExtensions } from "@/lib/tiptap-extensions";
import { fieldClass } from "@/components/ui/field";
import type { TiptapDoc } from "@/lib/tiptap-doc";
import type { SavePageResult } from "@/app/(app)/teacher/pages/actions";

type Lesson = { id: string; subject: string };

type Props = {
  pageId: string;
  initialTitle: string;
  initialContent: TiptapDoc;
  initialLessonId: string | null;
  lessons: Lesson[];
  saveAction: (input: {
    pageId: string;
    title?: string;
    contentJson?: unknown;
    lessonId?: string | null;
  }) => Promise<SavePageResult>;
};

type Status = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;

const btn =
  "rounded-chip border border-line px-2 py-1 text-sm hover:bg-surface-2 disabled:opacity-40";
const btnActive = "bg-primary text-primary-ink";

export function PageEditor({
  pageId,
  initialTitle,
  initialContent,
  initialLessonId,
  lessons,
  saveAction,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [lessonId, setLessonId] = useState<string>(initialLessonId ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDocRef = useRef<TiptapDoc | null>(null);

  const persist = useCallback(
    async (patch: {
      title?: string;
      contentJson?: unknown;
      lessonId?: string | null;
    }) => {
      setStatus("saving");
      setDetail(null);
      const result = await saveAction({ pageId, ...patch });
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setDetail(result.error);
      }
    },
    [pageId, saveAction],
  );

  const editor = useEditor({
    extensions: pageExtensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "tiptap-content min-h-[24rem] focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      pendingDocRef.current = editor.getJSON() as TiptapDoc;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const doc = pendingDocRef.current;
        pendingDocRef.current = null;
        if (doc) void persist({ contentJson: doc });
      }, DEBOUNCE_MS);
    },
  });

  // Flush a pending edit if the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      const doc = pendingDocRef.current;
      if (doc) void saveAction({ pageId, contentJson: doc });
    };
  }, [pageId, saveAction]);

  const statusText =
    status === "saving"
      ? "Збереження…"
      : status === "saved"
        ? "Збережено"
        : status === "error"
          ? `Помилка збереження${detail ? `: ${detail}` : ""}`
          : "Зміни зберігаються автоматично";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== initialTitle) void persist({ title: next });
          }}
          placeholder="Назва сторінки"
          className={`${fieldClass} flex-1 text-lg font-medium`}
        />
        <select
          value={lessonId}
          onChange={(e) => {
            const next = e.target.value;
            setLessonId(next);
            void persist({ lessonId: next || null });
          }}
          className={`${fieldClass} sm:w-56`}
        >
          <option value="">— без уроку —</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.subject}
            </option>
          ))}
        </select>
      </div>

      {editor ? <Toolbar editor={editor} /> : null}

      <div className="border-line rounded-card bg-surface px-4 py-3">
        <EditorContent editor={editor} />
      </div>

      <p
        className={
          status === "error" ? "text-danger text-xs" : "text-muted text-xs"
        }
      >
        {statusText}
      </p>
    </div>
  );
}

function Toolbar({
  editor,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const mark = (name: string, active: boolean, run: () => void) => (
    <button
      type="button"
      onClick={run}
      className={`${btn} ${active ? btnActive : ""}`}
    >
      {name}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1">
      {mark("Ж", editor.isActive("bold"), () =>
        editor.chain().focus().toggleBold().run(),
      )}
      {mark("К", editor.isActive("italic"), () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      {mark("S", editor.isActive("strike"), () =>
        editor.chain().focus().toggleStrike().run(),
      )}
      {mark("</>", editor.isActive("code"), () =>
        editor.chain().focus().toggleCode().run(),
      )}
      {mark("H1", editor.isActive("heading", { level: 1 }), () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
      )}
      {mark("H2", editor.isActive("heading", { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      )}
      {mark("H3", editor.isActive("heading", { level: 3 }), () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
      )}
      {mark("•", editor.isActive("bulletList"), () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {mark("1.", editor.isActive("orderedList"), () =>
        editor.chain().focus().toggleOrderedList().run(),
      )}
      {mark("☑", editor.isActive("taskList"), () =>
        editor.chain().focus().toggleTaskList().run(),
      )}
      {mark("❝", editor.isActive("blockquote"), () =>
        editor.chain().focus().toggleBlockquote().run(),
      )}
      {mark("{ }", editor.isActive("codeBlock"), () =>
        editor.chain().focus().toggleCodeBlock().run(),
      )}
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn}
      >
        —
      </button>
      <button
        type="button"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className={btn}
      >
        Таблиця
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={btn}
      >
        ↶
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={btn}
      >
        ↷
      </button>
    </div>
  );
}
