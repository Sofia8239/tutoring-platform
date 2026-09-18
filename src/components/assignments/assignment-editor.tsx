"use client";

import { useState, useTransition } from "react";

import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/server/ai/task-schema";
import type { AssignmentContent } from "@/server/lessons/assignment-edit";

import { fieldClass, labelClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

import {
  refineAssignmentAction,
  updateAssignmentAction,
} from "@/app/(app)/teacher/assignments/[assignmentId]/actions";

const field = fieldClass;

const linesToArray = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function AssignmentEditor({
  assignmentId,
  initial,
  aiEnabled,
}: {
  assignmentId: string;
  initial: AssignmentContent;
  aiEnabled: boolean;
}) {
  const [c, setC] = useState<AssignmentContent>(initial);
  const [steps, setSteps] = useState(initial.solutionSteps.join("\n"));
  const [hints, setHints] = useState(initial.hints.join("\n"));
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyContent(next: AssignmentContent) {
    setC(next);
    setSteps(next.solutionSteps.join("\n"));
    setHints(next.hints.join("\n"));
  }

  function save() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const res = await updateAssignmentAction({
        assignmentId,
        patch: {
          title: c.title,
          description: c.description,
          difficulty: c.difficulty ?? undefined,
          type: c.type,
          answer: c.answer,
          example: c.example,
          solutionSteps: linesToArray(steps),
          hints: linesToArray(hints),
        },
      });
      if (res.ok) {
        applyContent(res.content);
        setStatus("Збережено.");
      } else {
        setError(res.error);
      }
    });
  }

  function refine() {
    const text = instruction.trim();
    if (!text) return;
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const res = await refineAssignmentAction({
        assignmentId,
        instruction: text,
      });
      if (res.ok) {
        applyContent(res.content);
        setInstruction("");
        setStatus("Оновлено через AI.");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {aiEnabled ? (
        <div className="border-line rounded-card bg-surface-2 flex flex-col gap-2 border p-4">
          <span className="text-sm font-medium">Доопрацювати через AI</span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="Напр. зроби складніше · заміни числа · додай ще одну підказку"
            className={field}
          />
          <button
            type="button"
            onClick={refine}
            disabled={pending}
            className={buttonClass("primary", "md", "w-fit")}
          >
            {pending ? "Обробка…" : "Доопрацювати"}
          </button>
        </div>
      ) : null}

      <label className={labelClass}>
        <span className="font-medium">Назва</span>
        <input
          value={c.title}
          onChange={(e) => setC({ ...c, title: e.target.value })}
          className={field}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className="font-medium">Тип</span>
          <input
            value={c.type}
            onChange={(e) => setC({ ...c, type: e.target.value })}
            className={field}
          />
        </label>
        <label className={labelClass}>
          <span className="font-medium">Складність</span>
          <select
            value={c.difficulty ?? ""}
            onChange={(e) =>
              setC({
                ...c,
                difficulty:
                  (e.target.value as (typeof DIFFICULTIES)[number]) || null,
              })
            }
            className={field}
          >
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        <span className="font-medium">Умова</span>
        <textarea
          value={c.description}
          onChange={(e) => setC({ ...c, description: e.target.value })}
          rows={4}
          className={field}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Відповідь</span>
        <input
          value={c.answer}
          onChange={(e) => setC({ ...c, answer: e.target.value })}
          className={field}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Приклад виконання схожого завдання</span>
        <textarea
          value={c.example}
          onChange={(e) => setC({ ...c, example: e.target.value })}
          rows={3}
          className={field}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Кроки виконання (один на рядок)</span>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={4}
          className={field}
        />
      </label>

      <label className={labelClass}>
        <span className="font-medium">Підказки (одна на рядок)</span>
        <textarea
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          rows={3}
          className={field}
        />
      </label>

      {status ? <p className="text-success text-sm">{status}</p> : null}
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={buttonClass("primary", "md", "w-fit")}
      >
        {pending ? "Збереження…" : "Зберегти зміни"}
      </button>
    </div>
  );
}
