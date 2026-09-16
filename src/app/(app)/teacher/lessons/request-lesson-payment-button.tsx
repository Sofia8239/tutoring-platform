"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button";
import {
  requestLessonPaymentAction,
  type RequestPaymentState,
} from "@/app/(app)/teacher/payments/actions";

const initial: RequestPaymentState = { ok: false, message: null };

export function RequestLessonPaymentButton({ lessonId }: { lessonId: string }) {
  const [state, formAction, pending] = useActionState(
    requestLessonPaymentAction,
    initial,
  );

  if (state.ok) {
    return <p className="text-success text-sm">{state.message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="lessonId" value={lessonId} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("secondary", "sm", "w-fit")}
      >
        {pending ? "Створення…" : "Запросити оплату"}
      </button>
      {state.message ? (
        <p className="text-danger text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}
