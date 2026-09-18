"use client";

import { useActionState } from "react";

import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  addDisciplineAction,
  removeDisciplineAction,
  setPrimaryDisciplineAction,
  updateMeetingUrlAction,
  type DisciplineActionState,
  type SettingsState,
} from "./actions";

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

type Discipline = { id: string; key: string; label: string; isPrimary: boolean };

const disciplineInitial: DisciplineActionState = { ok: false, message: null };

export function DisciplinesForm({
  disciplines,
}: {
  disciplines: Discipline[];
}) {
  const [state, formAction, pending] = useActionState(
    addDisciplineAction,
    disciplineInitial,
  );

  return (
    <div className="flex flex-col gap-3">
      {disciplines.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {disciplines.map((d) => (
            <li
              key={d.id}
              className="border-line flex items-center justify-between gap-2 rounded-btn border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                {d.label}
                {d.isPrimary ? <Badge tone="primary">Основний</Badge> : null}
              </span>
              <span className="flex items-center gap-2">
                {!d.isPrimary ? (
                  <form action={setPrimaryDisciplineAction}>
                    <input type="hidden" name="disciplineId" value={d.id} />
                    <button
                      type="submit"
                      className="text-muted hover:text-ink text-xs underline"
                    >
                      Зробити основним
                    </button>
                  </form>
                ) : null}
                <form action={removeDisciplineAction}>
                  <input type="hidden" name="disciplineId" value={d.id} />
                  <button
                    type="submit"
                    className="text-danger text-xs underline"
                  >
                    Видалити
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">Ще не додано жодного предмета.</p>
      )}

      <form action={formAction} className="flex max-w-xl items-end gap-2">
        <label className={`${labelClass} flex-1`}>
          <span className="font-medium">Додати предмет</span>
          <input
            name="label"
            maxLength={60}
            placeholder="Напр. Англійська мова"
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("secondary", "md")}
        >
          {pending ? "Додавання…" : "Додати"}
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
