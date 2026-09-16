"use client";

import { useActionState } from "react";

import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import {
  requestManualPaymentAction,
  type RequestPaymentState,
} from "./actions";

const initial: RequestPaymentState = { ok: false, message: null };

export function RequestPaymentForm({
  students,
}: {
  students: { id: string; name: string | null; email: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    requestManualPaymentAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        <span className="font-medium">Учень</span>
        <select name="studentId" required className={fieldClass}>
          <option value="" disabled>
            Оберіть учня
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ? `${s.name} (${s.email})` : s.email}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className="font-medium">Сума, ₴</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="600"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          <span className="font-medium">Опис (необовʼязково)</span>
          <input
            name="description"
            maxLength={300}
            placeholder="Напр. блок занять на вересень"
            className={fieldClass}
          />
        </label>
      </div>

      {state.message ? (
        <p
          className={state.ok ? "text-success text-sm" : "text-danger text-sm"}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "md", "w-fit")}
      >
        {pending ? "Створення…" : "Запросити оплату"}
      </button>
    </form>
  );
}
