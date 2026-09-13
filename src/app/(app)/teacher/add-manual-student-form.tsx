"use client";

import { useActionState } from "react";

import { fieldClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import { addManualStudentAction, type AddStudentState } from "./actions";

const initial: AddStudentState = { ok: false, message: null };

export function AddManualStudentForm() {
  const [state, formAction, pending] = useActionState(
    addManualStudentAction,
    initial,
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-xs">
        Або додайте учня без облікового запису — лише для обліку уроків і оплат.
        Він не зможе увійти, писати в чат чи отримувати нагадування.
      </p>
      <form
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <input
          name="name"
          required
          placeholder="Імʼя учня"
          className={`${fieldClass} sm:flex-1`}
        />
        <input
          name="email"
          type="email"
          placeholder="email (необовʼязково)"
          className={`${fieldClass} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "md", "shrink-0")}
        >
          {pending ? "…" : "Додати"}
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
