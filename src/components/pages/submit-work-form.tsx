"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import {
  requestUploadAction,
  submitAssignmentAction,
} from "@/app/(app)/student/assignments/[assignmentId]/actions";

const inputClass = fieldClass;

export function SubmitWorkForm({
  assignmentId,
  uploadsEnabled,
}: {
  assignmentId: string;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    setError(null);
    const file = fileRef.current?.files?.[0] ?? null;

    if (!text.trim() && !file) {
      setError("Додайте текст або файл.");
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setError("Файл більший за 10 МБ.");
      return;
    }

    startTransition(async () => {
      let fileKey: string | null = null;
      let fileType: string | null = null;

      if (file) {
        const presign = await requestUploadAction({
          assignmentId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });
        if (!presign.ok) {
          setError(presign.error);
          return;
        }
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) {
          setError("Не вдалося завантажити файл.");
          return;
        }
        fileKey = presign.key;
        fileType = file.type;
      }

      const res = await submitAssignmentAction({
        assignmentId,
        text,
        fileKey,
        fileType,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <label className={labelClass}>
        <span className="font-medium">Ваша робота (текст)</span>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишіть розвʼязання або поясніть відповідь"
          className={inputClass}
        />
      </label>

      {uploadsEnabled ? (
        <label className={labelClass}>
          <span className="font-medium">
            Або файл (JPEG / PNG / WEBP / PDF, ≤ 10 МБ)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="text-sm"
          />
        </label>
      ) : null}

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={buttonClass("primary", "md", "w-fit")}
      >
        {pending ? "Здаємо…" : "Здати роботу"}
      </button>
    </div>
  );
}
