"use client";

import { useActionState } from "react";

import { CalendarSyncStatus } from "@/generated/prisma/enums";

import { buttonClass } from "@/components/ui/button";

import { retryLessonSyncAction, type LessonMutationState } from "./actions";

const STATUS_LABEL: Record<CalendarSyncStatus, string> = {
  [CalendarSyncStatus.PENDING]: "Очікує синхронізації",
  [CalendarSyncStatus.SYNCED]: "Синхронізовано з Google Календарем",
  [CalendarSyncStatus.FAILED]: "Помилка синхронізації з Google Календарем",
  [CalendarSyncStatus.DELETED]: "Подію в Google Календарі видалено",
};

export function LessonSyncPanel({
  lessonId,
  syncStatus,
  syncError,
  htmlLink,
  lastSyncedLabel,
}: {
  lessonId: string;
  syncStatus: CalendarSyncStatus | null;
  syncError: string | null;
  htmlLink: string | null;
  lastSyncedLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    LessonMutationState,
    FormData
  >(retryLessonSyncAction, { ok: false, message: null });

  const failed = syncStatus === CalendarSyncStatus.FAILED;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className={failed ? "text-danger" : "text-muted"}>
        {syncStatus ? STATUS_LABEL[syncStatus] : "Ще не синхронізовано"}
        {lastSyncedLabel ? ` · ${lastSyncedLabel}` : ""}
      </p>

      {failed && syncError ? (
        <p className="text-muted text-xs">{syncError}</p>
      ) : null}

      {htmlLink ? (
        <a
          href={htmlLink}
          target="_blank"
          rel="noreferrer"
          className="w-fit underline"
        >
          Відкрити в Google Календарі
        </a>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "sm", "w-fit")}
        >
          {pending ? "Синхронізація…" : "Синхронізувати з Google"}
        </button>
      </form>

      {state.message ? (
        <p className={state.ok ? "text-success" : "text-danger"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
