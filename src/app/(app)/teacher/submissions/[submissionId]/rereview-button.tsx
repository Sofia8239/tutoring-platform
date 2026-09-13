"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button";

import { rereviewSubmissionAction, type RereviewState } from "./actions";

export function RereviewButton({ submissionId }: { submissionId: string }) {
  const [state, formAction, pending] = useActionState<RereviewState, FormData>(
    rereviewSubmissionAction,
    { ok: false, message: null },
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "sm", "w-fit")}
        >
          {pending ? "Перевірка…" : "Перепровести AI-перевірку"}
        </button>
      </form>
      {state.message ? (
        <p
          className={state.ok ? "text-success text-sm" : "text-danger text-sm"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
