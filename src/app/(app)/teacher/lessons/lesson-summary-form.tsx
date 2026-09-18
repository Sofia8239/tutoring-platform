"use client";

import { useActionState } from "react";

import { fieldClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import {
  updateLessonSummaryAction,
  type SummaryActionState,
} from "./actions";

export function LessonSummaryForm({
  lessonId,
  initialValue,
}: {
  lessonId: string;
  initialValue: string;
}) {
  const [state, formAction, pending] = useActionState<
    SummaryActionState,
    FormData
  >(updateLessonSummaryAction, {
    ok: false,
    message: null,
    value: initialValue,
  });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="lessonId" value={lessonId} />
      <textarea
        name="summary"
        rows={4}
        defaultValue={state.value}
        placeholder="Коротко опишіть, що було на уроці — тему, що вдалося, над чим працювати далі…"
        className={fieldClass}
      />
      {state.message ? (
        <p
          className={state.ok ? "text-success text-sm" : "text-danger text-sm"}
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "sm", "w-fit")}
        >
          {pending ? "Збереження…" : "Зберегти"}
        </button>
        <button
          type="button"
          disabled
          title="Автозаповнення з допомогою AI зʼявиться тут пізніше"
          className={buttonClass(
            "secondary",
            "sm",
            "w-fit cursor-not-allowed opacity-50",
          )}
        >
          ✨ Згенерувати з AI (скоро)
        </button>
      </div>
    </form>
  );
}
