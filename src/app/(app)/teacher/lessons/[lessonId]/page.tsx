import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatInZone } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  LESSON_STATUS_LABEL,
  lessonDurationMinutes,
} from "@/lib/lesson-display";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-display";
import {
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
} from "@/lib/submission-display";
import { getUserTimezone } from "@/server/users/users";
import { getLessonForTeacher } from "@/server/lessons/lessons";
import { getLessonSyncState } from "@/server/lessons/calendar-sync";
import { listTeacherLessonPages } from "@/server/pages/pages";
import { listAssignmentsForTeacherLesson } from "@/server/lessons/assignments";
import { resolveLessonDisciplineLabel } from "@/server/teacher/disciplines";
import { isGoogleCalendarConfigured } from "@/server/integrations/google/config";
import { isPaymentsConfigured } from "@/server/payments/provider";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { LessonPagesExport } from "@/components/lessons/lesson-pages-export";
import { MaterialTile } from "@/components/lessons/material-tile";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";
import { createPageAction } from "@/app/(app)/teacher/pages/actions";

import { LessonStatusActions } from "../lesson-status-actions";
import { LessonSyncPanel } from "../lesson-sync-panel";
import { LessonSummaryForm } from "../lesson-summary-form";
import { RequestLessonPaymentButton } from "../request-lesson-payment-button";

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
  const [lesson, timezone, syncState, pages, assignments, payment] =
    await Promise.all([
      getLessonForTeacher(teacherId, lessonId),
      getUserTimezone(user.id),
      googleConfigured ? getLessonSyncState(teacherId, lessonId) : null,
      listTeacherLessonPages(teacherId, lessonId),
      listAssignmentsForTeacherLesson(teacherId, lessonId),
      prisma.payment.findFirst({
        where: { lessonId, teacherId },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      }),
    ]);

  if (!lesson) notFound();

  const disciplineLabel = await resolveLessonDisciplineLabel(
    teacherId,
    lesson,
  );

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
          <Row label="Учень">
            {lesson.student.name ?? "—"}
            <span className="text-muted block">{lesson.student.email}</span>
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

      <Card className="flex flex-col gap-3">
        <CardTitle>Що було на уроці</CardTitle>
        <LessonSummaryForm lessonId={lesson.id} initialValue={lesson.summary ?? ""} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <MaterialTile
            icon="board"
            label="Дошка"
            href={`/teacher/lessons/${lesson.id}/whiteboard`}
          />
          <MaterialTile
            icon="file"
            label="Конспект"
            meta={pages.length > 0 ? `${pages.length}` : "Немає"}
            href={pages.length > 0 ? `/teacher/pages/${pages[0].id}` : null}
          />
          <MaterialTile
            icon="inbox"
            label="ДЗ"
            meta={assignments.length > 0 ? `${assignments.length}` : "Створити"}
            href={
              assignments.length > 0
                ? "#assignments"
                : `/teacher/lessons/${lesson.id}/generate`
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/teacher/lessons/${lesson.id}/chat`}
            className="text-muted hover:text-ink text-xs"
          >
            Чат уроку →
          </Link>
          <span className="flex items-center gap-3">
            <Link
              href={`/teacher/lessons/${lesson.id}/generate`}
              className="text-muted hover:text-ink text-xs"
            >
              + Згенерувати ДЗ з дошки
            </Link>
            <form action={createPageAction}>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <button
                type="submit"
                className="text-muted hover:text-ink text-xs"
              >
                + Нова сторінка конспекту
              </button>
            </form>
          </span>
        </div>

        {pages.length > 1 ? (
          <div className="border-line flex flex-col gap-2 border-t pt-3">
            <span className="text-sm font-medium">Усі сторінки конспекту</span>
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
                    href={
                      a.latestSubmission
                        ? `/teacher/submissions/${a.latestSubmission.id}`
                        : `/teacher/assignments/${a.id}`
                    }
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
                      <Badge tone="neutral">Не здано</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {lesson.price > 0 ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>Оплата</CardTitle>
          {payment ? (
            <p className="flex items-center gap-2 text-sm">
              <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>
                {PAYMENT_STATUS_LABEL[payment.status]}
              </Badge>
              <Link
                href="/teacher/payments"
                className="text-muted hover:text-ink text-xs"
              >
                Усі платежі →
              </Link>
            </p>
          ) : isPaymentsConfigured() ? (
            <RequestLessonPaymentButton lessonId={lesson.id} />
          ) : (
            <p className="text-muted text-sm">
              Онлайн-оплату не налаштовано на сервері.
            </p>
          )}
        </Card>
      ) : null}

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
