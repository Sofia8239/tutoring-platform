import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatInZone } from "@/lib/datetime";
import { getUserTimezone } from "@/server/users/users";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Кабінет учня" };

export default async function StudentHomePage() {
  const user = await requireRole(UserRole.STUDENT);

  const [upcomingLessons, openAssignments, completedCount, timezone] =
    await Promise.all([
      prisma.lesson.findMany({
        where: {
          studentId: user.id,
          status: LessonStatus.SCHEDULED,
          scheduledStart: { gte: new Date() },
        },
        orderBy: { scheduledStart: "asc" },
        take: 5,
        select: { id: true, subject: true, scheduledStart: true },
      }),
      prisma.assignment.findMany({
        where: {
          studentId: user.id,
          submissions: { none: { studentId: user.id } },
        },
        orderBy: { dueAt: "asc" },
        take: 5,
        select: { id: true, title: true, dueAt: true },
      }),
      prisma.lesson.count({
        where: { studentId: user.id, status: LessonStatus.COMPLETED },
      }),
      getUserTimezone(user.id),
    ]);

  const firstName = (user.name ?? "").split(" ")[0] || "друже";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Привіт, ${firstName} 👋`}
        subtitle="Ваші уроки й домашні завдання."
      />

      <section className="grid grid-cols-3 gap-3">
        <StatTile
          label="Уроків попереду"
          value={String(upcomingLessons.length)}
          tint="peach"
        />
        <StatTile
          label="Проведено"
          value={String(completedCount)}
          tint="mint"
        />
        <StatTile
          label="Домашніх"
          value={String(openAssignments.length)}
          tint="lavender"
        />
      </section>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle>Найближчі уроки</CardTitle>
          <Link
            href="/student/lessons"
            className="text-muted hover:text-ink text-sm font-medium"
          >
            Усі →
          </Link>
        </div>
        {upcomingLessons.length === 0 ? (
          <EmptyState
            icon={<Icon name="calendar" className="size-5" />}
            title="Запланованих уроків немає"
            description="Коли викладач призначить урок, він зʼявиться тут."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingLessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/student/lessons/${lesson.id}`}
                  className="rounded-btn hover:bg-surface-2 -mx-2 flex items-center justify-between gap-3 px-2 py-2"
                >
                  <span className="text-sm font-medium">{lesson.subject}</span>
                  <span className="text-muted shrink-0 text-xs">
                    {formatInZone(lesson.scheduledStart, timezone)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Завдання без відповіді</CardTitle>
        {openAssignments.length === 0 ? (
          <EmptyState
            icon={<Icon name="check" className="size-5" />}
            title="Усе виконано"
            description="Немає домашніх завдань, які чекають на відповідь."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {openAssignments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/student/assignments/${a.id}`}
                  className="rounded-btn hover:bg-surface-2 -mx-2 flex items-center justify-between gap-3 px-2 py-2"
                >
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="text-muted shrink-0 text-xs">
                    {a.dueAt
                      ? formatInZone(a.dueAt, timezone, { dateStyle: "medium" })
                      : "без терміну"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
