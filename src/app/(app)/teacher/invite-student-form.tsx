"use client";

import { useActionState } from "react";

import { fieldClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import { inviteStudentAction, type InviteState } from "./actions";

const initialState: InviteState = { ok: false, message: null, link: null };

export function InviteStudentForm() {
  const [state, formAction, pending] = useActionState(
    inviteStudentAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="email учня"
          className={`${fieldClass} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md", "shrink-0")}
        >
          {pending ? "…" : "Запросити"}
        </button>
      </form>

      {state.message ? (
        <p
          className={state.ok ? "text-success text-sm" : "text-danger text-sm"}
        >
          {state.message}
        </p>
      ) : null}

      {state.link ? (
        <code className="rounded-btn bg-surface-2 block overflow-x-auto px-3 py-2 text-xs">
          {state.link}
        </code>
      ) : null}
    </div>
  );
}
