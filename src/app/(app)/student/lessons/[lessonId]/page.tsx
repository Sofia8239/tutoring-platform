import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatInZone } from "@/lib/datetime";
import {
  LESSON_STATUS_LABEL,
  lessonDurationMinutes,
} from "@/lib/lesson-display";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
} from "@/lib/submission-display";
import { getUserTimezone } from "@/server/users/users";
import { getLessonForStudent } from "@/server/lessons/lessons";
import { listStudentLessonPages } from "@/server/pages/pages";
import { listAssignmentsForStudentLesson } from "@/server/lessons/assignments";
import { resolveLessonDisciplineLabel } from "@/server/teacher/disciplines";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { MaterialTile } from "@/components/lessons/material-tile";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Урок" };

export default async function StudentLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await params;

  const [lesson, timezone, pages, assignments] = await Promise.all([
    getLessonForStudent(user.id, lessonId),
    getUserTimezone(user.id),
    listStudentLessonPages(user.id, lessonId),
    listAssignmentsForStudentLesson(user.id, lessonId),
  ]);

  if (!lesson) notFound();

  const disciplineLabel = await resolveLessonDisciplineLabel(
    teacherId,
    lesson,
  );

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
          {disciplineLabel ? (
            <Badge tone="neutral">{disciplineLabel}</Badge>
          ) : null}
        </div>
        <span className="text-muted text-sm">
          {formatInZone(lesson.scheduledStart, timezone)} ·{" "}
          {lessonDurationMinutes(lesson.scheduledStart, lesson.scheduledEnd)}{" "}
          хв · {timezone}
        </span>
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
        <CardTitle>Що було на уроці</CardTitle>
        {lesson.summary ? (
          <p className="text-sm whitespace-pre-wrap">{lesson.summary}</p>
        ) : (
          <p className="text-muted text-sm">
            Викладач ще не додав підсумок цього уроку.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <MaterialTile
            icon="board"
            label="Дошка"
            href={`/student/lessons/${lesson.id}/whiteboard`}
          />
          <MaterialTile
            icon="file"
            label="Конспект"
            meta={pages.length > 0 ? `${pages.length}` : "Немає"}
            href={pages.length > 0 ? `/student/pages/${pages[0].id}` : null}
          />
          <MaterialTile
            icon="inbox"
            label="ДЗ"
            meta={assignments.length > 0 ? `${assignments.length}` : "Немає"}
            href={assignments.length > 0 ? "#assignments" : null}
          />
        </div>

        <Link
          href={`/student/lessons/${lesson.id}/chat`}
          className="text-muted hover:text-ink text-xs"
        >
          Чат уроку →
        </Link>

        {pages.length > 1 ? (
          <div className="border-line flex flex-col gap-2 border-t pt-3">
            <span className="text-sm font-medium">Усі сторінки конспекту</span>
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
          </div>
        ) : null}

        {assignments.length > 0 ? (
          <div
            id="assignments"
            className="border-line flex flex-col gap-2 border-t pt-3 scroll-mt-4"
          >
            <span className="text-sm font-medium">Домашні завдання</span>
            <ul className="divide-line border-line rounded-btn divide-y border text-sm">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/student/assignments/${a.id}`}
                    className="hover:bg-surface-2 flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="flex flex-col">
                      <span>{a.title}</span>
                      <span className="text-muted text-xs">
                        {a.dueAt
                          ? `до ${a.dueAt.toLocaleDateString("uk-UA")}`
                          : "без терміну"}
                      </span>
                    </span>
                    {a.latestSubmission ? (
                      <Badge
                        tone={SUBMISSION_STATUS_TONE[a.latestSubmission.status]}
                      >
                        {SUBMISSION_STATUS_LABEL[a.latestSubmission.status]}
                        {a.latestSubmission.score !== null
                          ? ` · ${a.latestSubmission.score}/100`
                          : ""}
                      </Badge>
                    ) : (
                      <Badge tone="attention">Здати</Badge>
                    )}
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
