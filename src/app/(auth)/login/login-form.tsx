"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button";
import { fieldClass, labelClass } from "@/components/ui/field";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className={labelClass}>
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </label>

      <label className={labelClass}>
        <span>Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "Вхід…" : "Увійти"}
      </button>
    </form>
  );
}
