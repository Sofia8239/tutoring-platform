"use client";

import Link from "next/link";
import { useActionState } from "react";

import { fieldClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import {
  createLessonAction,
  updateLessonAction,
  type LessonFormState,
  type LessonFormValues,
} from "./actions";

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const inputClass = fieldClass;

type Props = {
  students: { id: string; name: string | null; email: string }[];
  timezone: string;
  mode: "create" | "edit";
  lessonId?: string;
  initialValues: LessonFormValues;
};

export function LessonForm({
  students,
  timezone,
  mode,
  lessonId,
  initialValues,
}: Props) {
  const action = mode === "create" ? createLessonAction : updateLessonAction;
  const [state, formAction, pending] = useActionState<
    LessonFormState,
    FormData
  >(action, { ok: false, message: null, values: initialValues });

  const values = state.values;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {mode === "edit" && lessonId ? (
        <input type="hidden" name="lessonId" value={lessonId} />
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Учень</span>
        <select
          name="studentId"
          required
          defaultValue={values.studentId}
          className={inputClass}
        >
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Тема</span>
        <input
          name="subject"
          required
          maxLength={200}
          defaultValue={values.subject}
          placeholder="Напр. Математика — квадратні рівняння"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Початок</span>
          <input
            type="datetime-local"
            name="start"
            required
            defaultValue={values.start}
            className={inputClass}
          />
          <span className="text-muted text-xs">
            Час у вашій зоні: {timezone}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Тривалість</span>
          <select
            name="durationMinutes"
            defaultValue={values.durationMinutes || "60"}
            className={inputClass}
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} хв
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Ціна, ₴ (необовʼязково)</span>
        <input
          name="price"
          inputMode="decimal"
          defaultValue={values.price}
          placeholder="300"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          Посилання на зустріч (необовʼязково)
        </span>
        <input
          name="meetLink"
          type="url"
          inputMode="url"
          maxLength={2048}
          defaultValue={values.meetLink}
          placeholder="https://zoom.us/j/1234567890"
          className={inputClass}
        />
        <span className="text-muted text-xs">
          За замовчуванням — постійне посилання з{" "}
          <Link href="/teacher/settings" className="underline">
            налаштувань
          </Link>
          .
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Нотатки (необовʼязково)</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={values.notes}
          className={inputClass}
        />
      </label>

      {state.message ? (
        <p className="text-danger text-sm">{state.message}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md")}
        >
          {pending
            ? "Збереження…"
            : mode === "create"
              ? "Створити урок"
              : "Зберегти зміни"}
        </button>
        <Link
          href={
            mode === "edit" && lessonId
              ? `/teacher/lessons/${lessonId}`
              : "/teacher/lessons"
          }
          className="text-muted hover:text-ink text-sm"
        >
          Скасувати
        </Link>
      </div>
    </form>
  );
}
