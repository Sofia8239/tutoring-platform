"use client";

import { useState } from "react";
import { useActionState } from "react";

import { LessonStatus } from "@/generated/prisma/enums";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

import {
  changeLessonStatusAction,
  deleteLessonAction,
  type LessonMutationState,
} from "./actions";

const idle: LessonMutationState = { ok: false, message: null };

const primaryBtn = buttonClass("primary", "sm");
const secondaryBtn = buttonClass("secondary", "sm");
const dangerBtn = buttonClass("danger", "sm");

export function LessonStatusActions({
  lessonId,
  status,
}: {
  lessonId: string;
  status: LessonStatus;
}) {
  const [panel, setPanel] = useState<null | "cancel" | "delete">(null);
  const [statusState, statusAction, statusPending] = useActionState<
    LessonMutationState,
    FormData
  >(changeLessonStatusAction, idle);
  const [deleteState, deleteAction, deletePending] = useActionState<
    LessonMutationState,
    FormData
  >(deleteLessonAction, idle);

  const isScheduled = status === LessonStatus.SCHEDULED;
  const canDelete = status !== LessonStatus.COMPLETED;
  const message = statusState.message ?? deleteState.message;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {isScheduled ? (
          <>
            <form action={statusAction}>
              <input type="hidden" name="lessonId" value={lessonId} />
              <input
                type="hidden"
                name="status"
                value={LessonStatus.COMPLETED}
              />
              <button
                type="submit"
                disabled={statusPending}
                className={primaryBtn}
              >
                Провести
              </button>
            </form>

            <form action={statusAction}>
              <input type="hidden" name="lessonId" value={lessonId} />
              <input type="hidden" name="status" value={LessonStatus.NO_SHOW} />
              <button
                type="submit"
                disabled={statusPending}
                className={secondaryBtn}
              >
                Не зʼявився
              </button>
            </form>

            <button
              type="button"
              onClick={() => setPanel(panel === "cancel" ? null : "cancel")}
              className={secondaryBtn}
            >
              Скасувати
            </button>
          </>
        ) : null}

        {canDelete ? (
          <button
            type="button"
            onClick={() => setPanel(panel === "delete" ? null : "delete")}
            className={secondaryBtn}
          >
            Видалити
          </button>
        ) : null}
      </div>

      {panel === "cancel" ? (
        <form
          action={statusAction}
          className="border-line rounded-card bg-surface flex max-w-md flex-col gap-2 border p-4"
        >
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="status" value={LessonStatus.CANCELLED} />
          <label className="text-sm font-medium">Причина скасування</label>
          <textarea
            name="cancellationReason"
            rows={2}
            maxLength={500}
            placeholder="Напр. учень захворів"
            className={fieldClass}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={statusPending}
              className={dangerBtn}
            >
              Підтвердити скасування
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className={secondaryBtn}
            >
              Назад
            </button>
          </div>
        </form>
      ) : null}

      {panel === "delete" ? (
        <form
          action={deleteAction}
          className="border-danger/30 rounded-card bg-surface flex max-w-md flex-col gap-2 border p-4"
        >
          <input type="hidden" name="lessonId" value={lessonId} />
          <p className="text-sm">Видалити цей урок? Дію не можна скасувати.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={deletePending}
              className={dangerBtn}
            >
              Так, видалити
            </button>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className={secondaryBtn}
            >
              Ні
            </button>
          </div>
        </form>
      ) : null}

      {message ? <p className="text-danger text-sm">{message}</p> : null}
    </div>
  );
}
