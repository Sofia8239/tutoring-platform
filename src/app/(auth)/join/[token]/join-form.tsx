"use client";

import { useActionState } from "react";

import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import { acceptInvitationAction, type JoinState } from "./actions";

const initialState: JoinState = { error: null };

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label className={labelClass}>
        <span className="font-medium">Email</span>
        <input
          value={email}
          readOnly
          className={`${fieldClass} bg-surface-2 text-muted`}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Імʼя</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          className={fieldClass}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClass}
        />
      </label>

      {state.error ? (
        <p className="text-danger text-sm">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "md", "mt-1 w-full")}
      >
        {pending ? "Створення…" : "Створити акаунт"}
      </button>
    </form>
  );
}
