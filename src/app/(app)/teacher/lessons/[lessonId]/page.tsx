import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatInZone } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import {
  LESSON_STATUS_LABEL,
  lessonDurationMinutes,
} from "@/lib/lesson-display";
import { getUserTimezone } from "@/server/users/users";
import { getLessonForTeacher } from "@/server/lessons/lessons";
import { getLessonSyncState } from "@/server/lessons/calendar-sync";
import { listTeacherLessonPages } from "@/server/pages/pages";
import { listAssignmentsForTeacherLesson } from "@/server/lessons/assignments";
import { isGoogleCalendarConfigured } from "@/server/integrations/google/config";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { LessonPagesExport } from "@/components/lessons/lesson-pages-export";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";
import { createPageAction } from "@/app/(app)/teacher/pages/actions";

import { LessonStatusActions } from "../lesson-status-actions";
import { LessonSyncPanel } from "../lesson-sync-panel";

export const metadata: Metadata = { title: "Урок" };

export default async function TeacherLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await params;

  const googleConfigured = isGoogleCalendarConfigured();
  const [lesson, timezone, syncState, pages, assignments] = await Promise.all([
    getLessonForTeacher(teacherId, lessonId),
    getUserTimezone(user.id),
    googleConfigured ? getLessonSyncState(teacherId, lessonId) : null,
    listTeacherLessonPages(teacherId, lessonId),
    listAssignmentsForTeacherLesson(teacherId, lessonId),
  ]);

  if (!lesson) notFound();

  const isScheduled = lesson.status === LessonStatus.SCHEDULED;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/teacher/lessons"
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
          <Row label="Учень">
            {lesson.student.name ?? "—"}
            <span className="text-muted block">{lesson.student.email}</span>
          </Row>
          <Row label="Коли">
            {formatInZone(lesson.scheduledStart, timezone)}
            <span className="text-muted block">
              {lessonDurationMinutes(
                lesson.scheduledStart,
                lesson.scheduledEnd,
              )}{" "}
              хв · {timezone}
            </span>
          </Row>
          <Row label="Ціна">
            {lesson.price > 0
              ? formatMoney(lesson.price, lesson.currency)
              : "не вказано"}
          </Row>
          <Row label="Посилання на зустріч">
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
          </Row>
          {lesson.notes ? (
            <Row label="Нотатки" wide>
              {lesson.notes}
            </Row>
          ) : null}
          {lesson.status === LessonStatus.CANCELLED ? (
            <Row label="Причина скасування" wide>
              {lesson.cancellationReason ?? "—"}
              {lesson.cancelledAt ? (
                <span className="text-muted block">
                  {formatInZone(lesson.cancelledAt, timezone)}
                </span>
              ) : null}
            </Row>
          ) : null}
          {lesson.status === LessonStatus.COMPLETED && lesson.completedAt ? (
            <Row label="Проведено" wide>
              {formatInZone(lesson.completedAt, timezone)}
            </Row>
          ) : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Матеріали</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/teacher/lessons/${lesson.id}/whiteboard`}
            className={buttonClass("secondary", "sm")}
          >
            Відкрити дошку
          </Link>
          <Link
            href={`/teacher/lessons/${lesson.id}/chat`}
            className={buttonClass("secondary", "sm")}
          >
            Чат уроку
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Сторінки</span>
            <form action={createPageAction}>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Нова сторінка
              </button>
            </form>
          </div>
          {pages.length === 0 ? (
            <p className="text-muted text-sm">
              Сторінок для цього уроку ще немає.
            </p>
          ) : (
            <>
              <ul className="divide-line border-line rounded-btn divide-y border text-sm">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/teacher/pages/${page.id}`}
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
              <LessonPagesExport
                lessonId={lesson.id}
                pages={pages.map((p) => ({ id: p.id, title: p.title }))}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Завдання</span>
          {assignments.length === 0 ? (
            <p className="text-muted text-sm">
              Завдань ще немає. Згенеруйте їх зі сторінки-конспекту.
            </p>
          ) : (
            <ul className="divide-line border-line rounded-btn divide-y border text-sm">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/teacher/assignments/${a.id}`}
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
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Дії</CardTitle>
        {isScheduled ? (
          <Link
            href={`/teacher/lessons/${lesson.id}/edit`}
            className={buttonClass("secondary", "sm", "w-fit")}
          >
            Редагувати
          </Link>
        ) : (
          <p className="text-muted text-sm">
            Урок у статусі «{LESSON_STATUS_LABEL[lesson.status]}» — редагування
            недоступне.
          </p>
        )}
        <LessonStatusActions lessonId={lesson.id} status={lesson.status} />
      </Card>

      {googleConfigured ? (
        <Card className="flex flex-col gap-4">
          <CardTitle>Google Календар</CardTitle>
          <LessonSyncPanel
            lessonId={lesson.id}
            syncStatus={syncState?.syncStatus ?? null}
            syncError={syncState?.syncError ?? null}
            htmlLink={syncState?.htmlLink ?? null}
            lastSyncedLabel={
              syncState?.lastSyncedAt
                ? formatInZone(syncState.lastSyncedAt, timezone)
                : null
            }
          />
        </Card>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
