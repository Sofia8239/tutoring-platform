"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { DIFFICULTY_LABEL } from "@/server/ai/task-schema";
import type { GeneratedProblem } from "@/server/ai/task-schema";

import { fieldClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import {
  generateTasksAction,
  saveTasksAction,
  type GenerateInput,
} from "@/app/(app)/teacher/pages/[pageId]/generate/actions";

type Lesson = { id: string; subject: string; studentId: string };
type Student = { id: string; name: string | null; email: string };

const input = fieldClass;
const primaryBtn = buttonClass("primary", "md");
const secondaryBtn = buttonClass("secondary", "sm");

export function TaskGenerator({
  pageId,
  lessons,
  students,
}: {
  pageId: string;
  lessons: Lesson[];
  students: Student[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // form params
  const [instructions, setInstructions] = useState("");
  const [count, setCount] = useState(4);
  const [difficulty, setDifficulty] =
    useState<GenerateInput["difficulty"]>("mixed");
  const [lessonId, setLessonId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [includeWhiteboard, setIncludeWhiteboard] = useState(true);

  // results
  const [problems, setProblems] = useState<GeneratedProblem[] | null>(null);
  const [aiModel, setAiModel] = useState("");
  const [promptUsed, setPromptUsed] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dueAt, setDueAt] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === lessonId) ?? null,
    [lessons, lessonId],
  );

  function runGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateTasksAction({
        pageId,
        lessonId: lessonId || null,
        includeWhiteboard: includeWhiteboard && Boolean(lessonId),
        instructions,
        count,
        difficulty,
      });
      if (res.ok) {
        setProblems(res.problems);
        setAiModel(res.model);
        setPromptUsed(res.promptUsed);
        setSelected(new Set(res.problems.map((_, i) => i)));
        setSavedCount(null);
      } else if (res.ok === false) {
        setError(res.error);
      }
    });
  }

  function runSave() {
    if (!problems) return;
    setError(null);
    const chosen = problems.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      setError("Оберіть хоча б одну задачу.");
      return;
    }
    startTransition(async () => {
      const res = await saveTasksAction({
        pageId,
        problems: chosen,
        lessonId: lessonId || null,
        studentId: studentId || selectedLesson?.studentId || null,
        dueAt: dueAt || null,
        aiModel,
        aiPrompt: promptUsed,
      });
      if (res.ok) {
        setSavedCount(res.count);
        setProblems(null);
      } else if (res.ok === false) {
        setError(res.error);
      }
    });
  }

  if (savedCount !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-success text-sm">Збережено {savedCount} завдань.</p>
        <div className="flex gap-2">
          {lessonId ? (
            <Link
              href={`/teacher/lessons/${lessonId}`}
              className={secondaryBtn}
            >
              До уроку
            </Link>
          ) : null}
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => setSavedCount(null)}
          >
            Згенерувати ще
          </button>
        </div>
      </div>
    );
  }

  if (problems) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted text-xs">
          Модель: {aiModel}. Зніміть галочки з непотрібних задач.
        </p>

        <ul className="flex flex-col gap-3">
          {problems.map((p, i) => (
            <li key={i} className="border-line rounded-btn border p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setSelected(next);
                  }}
                  className="mt-1"
                />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-muted text-xs">
                    {p.type} · {DIFFICULTY_LABEL[p.difficulty]}
                  </span>
                  <span>{p.prompt}</span>
                  <details className="text-muted mt-1 text-xs">
                    <summary className="cursor-pointer">Розвʼязання</summary>
                    <div className="mt-1 flex flex-col gap-1">
                      <p>
                        <b>Відповідь:</b> {p.answer}
                      </p>
                      <p>
                        <b>Схожий приклад:</b> {p.example}
                      </p>
                      <p>
                        <b>Кроки:</b>
                      </p>
                      <ol className="list-decimal pl-5">
                        {p.solutionSteps.map((s, j) => (
                          <li key={j}>{s}</li>
                        ))}
                      </ol>
                      {p.hints.length > 0 ? (
                        <>
                          <p>
                            <b>Підказки:</b>
                          </p>
                          <ul className="list-disc pl-5">
                            {p.hints.map((h, j) => (
                              <li key={j}>{h}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </details>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Термін здачі (необовʼязково)</span>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={`${input} w-fit`}
          />
        </label>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={runSave}
            disabled={pending}
            className={primaryBtn}
          >
            {pending ? "Збереження…" : `Зберегти обрані (${selected.size})`}
          </button>
          <button
            type="button"
            onClick={() => setProblems(null)}
            disabled={pending}
            className={secondaryBtn}
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Додаткові вказівки (необовʼязково)</span>
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Напр. лише текстові задачі, без параметрів"
          className={input}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Кількість задач</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) =>
              setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
            }
            className={input}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Складність</span>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as GenerateInput["difficulty"])
            }
            className={input}
          >
            <option value="mixed">Суміш</option>
            <option value="easy">Лише легкі</option>
            <option value="medium">Лише середні</option>
            <option value="hard">Лише складні</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Урок (необовʼязково)</span>
        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className={input}
        >
          <option value="">— без уроку —</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.subject}
            </option>
          ))}
        </select>
      </label>

      {lessonId ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeWhiteboard}
            onChange={(e) => setIncludeWhiteboard(e.target.checked)}
          />
          Врахувати текст із дошки цього уроку
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Учень (необовʼязково)</span>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className={input}
        >
          <option value="">
            {selectedLesson ? "— учень уроку —" : "— не призначати —"}
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.email}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <button
        type="button"
        onClick={runGenerate}
        disabled={pending}
        className={primaryBtn}
      >
        {pending ? "Генерація…" : "Згенерувати"}
      </button>
    </div>
  );
}
