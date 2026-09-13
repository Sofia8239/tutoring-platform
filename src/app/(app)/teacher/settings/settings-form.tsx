"use client";

import { useActionState } from "react";

import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import { updateMeetingUrlAction, type SettingsState } from "./actions";

export function MeetingUrlForm({ initialValue }: { initialValue: string }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateMeetingUrlAction,
    { ok: false, message: null, value: initialValue },
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-2">
      <label className={labelClass}>
        <span className="font-medium">Постійне посилання на зустріч</span>
        <input
          name="defaultMeetingUrl"
          type="url"
          inputMode="url"
          maxLength={2048}
          defaultValue={state.value}
          placeholder="https://zoom.us/j/1234567890"
          className={fieldClass}
        />
        <span className="text-muted text-xs">
          Використовується як посилання за замовчуванням для нових уроків.
          Залиште порожнім, щоб прибрати.
        </span>
      </label>

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
        {pending ? "Збереження…" : "Зберегти"}
      </button>
    </form>
  );
}
