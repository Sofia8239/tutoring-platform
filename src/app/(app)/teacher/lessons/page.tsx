import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import {
  formatInZone,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
} from "@/lib/datetime";
import { addDaysISO, mondayOf } from "@/lib/calendar";
import { formatMoney } from "@/lib/money";
import { lessonDurationMinutes } from "@/lib/lesson-display";
import { getUserTimezone } from "@/server/users/users";
import {
  listLessonsForTeacher,
  listLessonsForTeacherRange,
  type TeacherLessonScope,
} from "@/server/lessons/lessons";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { LessonWeekCalendar } from "@/components/lessons/lesson-week-calendar";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Уроки" };

const TABS: { key: TeacherLessonScope; label: string }[] = [
  { key: "upcoming", label: "Майбутні" },
  { key: "past", label: "Минулі" },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const rangeLabel = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
});

function viewToggle(active: "calendar" | "list") {
  const cls = (on: boolean) =>
    `rounded-btn px-3 py-1.5 text-sm font-medium transition-colors ${
      on
        ? "bg-primary text-primary-ink"
        : "border border-line text-muted hover:bg-surface-2"
    }`;
  return (
    <div className="flex gap-1.5">
      <Link
        href="/teacher/lessons?view=calendar"
        className={cls(active === "calendar")}
      >
        Календар
      </Link>
      <Link
        href="/teacher/lessons?view=list"
        className={cls(active === "list")}
      >
        Список
      </Link>
    </div>
  );
}

export default async function TeacherLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; tab?: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { view, week, tab } = await searchParams;
  const timezone = await getUserTimezone(user.id);

  const isList = view === "list";

  const createButton = (
    <Link href="/teacher/lessons/new" className={buttonClass("primary", "md")}>
      Створити урок
    </Link>
  );

  // ---- Calendar (default) --------------------------------------------------
  if (!isList) {
    const todayISO = utcToZonedWallTime(new Date(), timezone).slice(0, 10);
    const anchorISO = week && DATE_RE.test(week) ? week : todayISO;
    const mondayISO = mondayOf(anchorISO);
    const nextMondayISO = addDaysISO(mondayISO, 7);
    const sundayISO = addDaysISO(mondayISO, 6);

    const from = zonedWallTimeToUtc(`${mondayISO}T00:00`, timezone);
    const to = zonedWallTimeToUtc(`${nextMondayISO}T00:00`, timezone);
    const lessons = await listLessonsForTeacherRange(teacherId, { from, to });

    const label = rangeLabel.formatRange(
      new Date(`${mondayISO}T12:00:00Z`),
      new Date(`${sundayISO}T12:00:00Z`),
    );

    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Уроки" actions={createButton} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/teacher/lessons?view=calendar&week=${addDaysISO(mondayISO, -7)}`}
              aria-label="Попередній тиждень"
              className="border-line text-muted hover:bg-surface-2 hover:text-ink rounded-btn grid size-8 place-items-center border"
            >
              ‹
            </Link>
            <Link
              href={`/teacher/lessons?view=calendar&week=${nextMondayISO}`}
              aria-label="Наступний тиждень"
              className="border-line text-muted hover:bg-surface-2 hover:text-ink rounded-btn grid size-8 place-items-center border"
            >
              ›
            </Link>
            <Link
              href="/teacher/lessons?view=calendar"
              className={buttonClass("secondary", "sm", "ml-1")}
            >
              Сьогодні
            </Link>
            <span className="text-ink ml-2 text-sm font-medium">{label}</span>
          </div>
          {viewToggle("calendar")}
        </div>

        <LessonWeekCalendar
          lessons={lessons.map((l) => ({
            id: l.id,
            subject: l.subject,
            personName: l.student.name ?? l.student.email,
            startISO: l.scheduledStart.toISOString(),
            endISO: l.scheduledEnd.toISOString(),
            status: l.status,
          }))}
          timezone={timezone}
          weekStartISO={mondayISO}
          lessonBasePath="/teacher/lessons"
          newLessonPath="/teacher/lessons/new"
        />

        <p className="text-muted text-xs">
          Часовий пояс: {timezone}. Натисніть на вільну годину, щоб створити
          урок.
        </p>
      </div>
    );
  }

  // ---- List --------------------------------------------------------------
  const scope: TeacherLessonScope = tab === "past" ? "past" : "upcoming";
  const lessons = await listLessonsForTeacher(teacherId, { scope });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Уроки" actions={createButton} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="border-line flex gap-1 border-b text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/teacher/lessons?view=list&tab=${t.key}`}
              className={
                scope === t.key
                  ? "border-primary text-ink -mb-px border-b-2 px-3 py-2 font-medium"
                  : "text-muted hover:text-ink px-3 py-2"
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {viewToggle("list")}
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" className="size-5" />}
          title={
            scope === "upcoming"
              ? "Немає запланованих уроків"
              : "Немає минулих уроків"
          }
          description={
            scope === "upcoming"
              ? "Створіть перший урок — він зʼявиться тут і в учня."
              : undefined
          }
          action={
            scope === "upcoming" ? (
              <Link
                href="/teacher/lessons/new"
                className={buttonClass("primary", "sm")}
              >
                Створити урок
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link href={`/teacher/lessons/${lesson.id}`} className="block">
                <Card className="hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {lesson.subject}
                    </span>
                    <span className="text-muted text-xs">
                      {lesson.student.name ?? lesson.student.email} ·{" "}
                      {formatInZone(lesson.scheduledStart, timezone)} ·{" "}
                      {lessonDurationMinutes(
                        lesson.scheduledStart,
                        lesson.scheduledEnd,
                      )}{" "}
                      хв
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {lesson.price > 0 ? (
                      <span className="text-muted text-xs">
                        {formatMoney(lesson.price, lesson.currency)}
                      </span>
                    ) : null}
                    <LessonStatusBadge status={lesson.status} />
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
