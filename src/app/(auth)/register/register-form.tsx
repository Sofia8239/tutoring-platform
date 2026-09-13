"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button";
import { fieldClass, labelClass } from "@/components/ui/field";

import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className={labelClass}>
        <span>Імʼя</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          className={fieldClass}
        />
      </label>

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
          autoComplete="new-password"
          minLength={8}
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
        {pending ? "Створюємо…" : "Створити акаунт"}
      </button>
    </form>
  );
}
