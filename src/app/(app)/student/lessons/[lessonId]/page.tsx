import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { formatInZone } from "@/lib/datetime";
import {
  LESSON_STATUS_LABEL,
  lessonDurationMinutes,
} from "@/lib/lesson-display";
import { getUserTimezone } from "@/server/users/users";
import { getLessonForStudent } from "@/server/lessons/lessons";
import { listStudentLessonPages } from "@/server/pages/pages";
import { listAssignmentsForStudentLesson } from "@/server/lessons/assignments";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Урок" };

export default async function StudentLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { lessonId } = await params;

  const [lesson, timezone, pages, assignments] = await Promise.all([
    getLessonForStudent(user.id, lessonId),
    getUserTimezone(user.id),
    listStudentLessonPages(user.id, lessonId),
    listAssignmentsForStudentLesson(user.id, lessonId),
  ]);

  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/student/lessons"
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроків
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {lesson.subject}
          </h1>
          <LessonStatusBadge status={lesson.status} />
        </div>
      </div>

      <Card>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Викладач</dt>
            <dd className="mt-0.5">
              {lesson.teacher.name ?? lesson.teacher.email}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Коли</dt>
            <dd className="mt-0.5">
              {formatInZone(lesson.scheduledStart, timezone)}
              <span className="text-muted block">
                {lessonDurationMinutes(
                  lesson.scheduledStart,
                  lesson.scheduledEnd,
                )}{" "}
                хв · {timezone}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Посилання на зустріч</dt>
            <dd className="mt-0.5">
              {lesson.meetLink ? (
                <a
                  href={lesson.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Приєднатися
                </a>
              ) : (
                <span className="text-muted">не вказано</span>
              )}
            </dd>
          </div>
          {lesson.status === LessonStatus.CANCELLED &&
          lesson.cancellationReason ? (
            <div className="sm:col-span-2">
              <dt className="text-muted text-xs">Причина скасування</dt>
              <dd className="mt-0.5">{lesson.cancellationReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Матеріали</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/student/lessons/${lesson.id}/whiteboard`}
            className={buttonClass("secondary", "sm")}
          >
            Відкрити дошку
          </Link>
          <Link
            href={`/student/lessons/${lesson.id}/chat`}
            className={buttonClass("secondary", "sm")}
          >
            Чат уроку
          </Link>
        </div>
        {pages.length > 0 ? (
          <ul className="divide-line border-line rounded-btn divide-y border text-sm">
            {pages.map((page) => (
              <li key={page.id}>
                <Link
                  href={`/student/pages/${page.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between px-3 py-2"
                >
                  <span>{page.title}</span>
                  <span className="text-muted">
                    {page.updatedAt.toLocaleDateString("uk-UA")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {assignments.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Завдання</span>
            <ul className="divide-line border-line rounded-btn divide-y border text-sm">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/student/assignments/${a.id}`}
                    className="hover:bg-surface-2 flex items-center justify-between px-3 py-2"
                  >
                    <span>{a.title}</span>
                    <span className="text-muted">
                      {a.dueAt
                        ? `до ${a.dueAt.toLocaleDateString("uk-UA")}`
                        : "без терміну"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <p className="text-muted text-sm">
        Статус: {LESSON_STATUS_LABEL[lesson.status]}. Зміни розкладу робить
        викладач.
      </p>
    </div>
  );
}
