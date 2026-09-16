"use client";

import { useActionState } from "react";

import type { ToggleCanEditState } from "@/app/(app)/teacher/lessons/[lessonId]/whiteboard/actions";

type Props = {
  lessonId: string;
  initialCanEdit: boolean;
  toggleAction: (
    prev: ToggleCanEditState,
    formData: FormData,
  ) => Promise<ToggleCanEditState>;
};

/**
 * Teacher-only control: "Учень може малювати" <-> "Учень тільки дивиться".
 * The student never sees this — WhiteboardCanvas only renders it for
 * `role === "teacher"`. Flipping it kicks any already-connected student so
 * the change takes effect immediately rather than on their next visit.
 */
export function WhiteboardPermissionToggle({
  lessonId,
  initialCanEdit,
  toggleAction,
}: Props) {
  const [state, formAction, pending] = useActionState(toggleAction, {
    ok: true,
    canEdit: initialCanEdit,
    message: null,
  });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="canEdit" value={String(!state.canEdit)} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={state.canEdit}
        aria-label="Учень може малювати"
        className={`focus-visible:outline-primary relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
          state.canEdit ? "bg-primary" : "bg-surface-2 border-line border"
        }`}
      >
        <span
          className={`bg-primary-ink absolute top-0.5 size-5 rounded-full shadow-sm transition-transform ${
            state.canEdit ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-sm font-medium">
        {state.canEdit ? "Учень може малювати" : "Учень тільки дивиться"}
      </span>
      {state.message ? (
        <span className="text-danger text-xs">{state.message}</span>
      ) : null}
    </form>
  );
}
