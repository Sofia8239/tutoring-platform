"use client";

import { useState } from "react";

import { buttonClass } from "@/components/ui/button";

/**
 * Pick some / all of a lesson's pages and download them as one PDF. The link
 * points at the export Route Handler, which answers with a
 * `Content-Disposition: attachment`, so the browser downloads without
 * navigating away.
 */
export function LessonPagesExport({
  lessonId,
  pages,
}: {
  lessonId: string;
  pages: { id: string; title: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pages.map((p) => p.id)),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const all = selected.size === pages.length;
  const query = all
    ? "pages=all"
    : [...selected].map((id) => `pages=${encodeURIComponent(id)}`).join("&");
  const href = `/teacher/lessons/${lessonId}/export?${query}`;
  const disabled = selected.size === 0;

  return (
    <div className="border-line rounded-btn flex flex-col gap-2 border p-3">
      <span className="text-muted text-xs font-medium">Експорт у PDF</span>
      <div className="flex flex-col gap-1">
        {pages.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="accent-primary size-4"
            />
            <span className="truncate">{p.title}</span>
          </label>
        ))}
      </div>
      <a
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        download
        className={buttonClass(
          "secondary",
          "sm",
          `w-fit ${disabled ? "pointer-events-none opacity-55" : ""}`,
        )}
      >
        {all
          ? "Завантажити всі сторінки"
          : `Завантажити обрані (${selected.size})`}
      </a>
    </div>
  );
}
