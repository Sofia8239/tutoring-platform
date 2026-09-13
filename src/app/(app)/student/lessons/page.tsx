import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { formatInZone } from "@/lib/datetime";
import { lessonDurationMinutes } from "@/lib/lesson-display";
import { getUserTimezone } from "@/server/users/users";
import {
  listLessonsForStudent,
  type LessonDTO,
} from "@/server/lessons/lessons";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Мої уроки" };

export default async function StudentLessonsPage() {
  const user = await requireRole(UserRole.STUDENT);

  const [upcoming, past, timezone] = await Promise.all([
    listLessonsForStudent(user.id, { scope: "upcoming" }),
    listLessonsForStudent(user.id, { scope: "past" }),
    getUserTimezone(user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Мої уроки" />

      <LessonGroup
        title="Найближчі"
        lessons={upcoming}
        timezone={timezone}
        empty="Запланованих уроків поки немає."
      />
      <LessonGroup
        title="Минулі"
        lessons={past}
        timezone={timezone}
        empty="Минулих уроків ще немає."
      />
    </div>
  );
}

function LessonGroup({
  title,
  lessons,
  timezone,
  empty,
}: {
  title: string;
  lessons: LessonDTO[];
  timezone: string;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      {lessons.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" className="size-5" />}
          title={empty}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link href={`/student/lessons/${lesson.id}`} className="block">
                <Card className="hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {lesson.subject}
                    </span>
                    <span className="text-muted text-xs">
                      {lesson.teacher.name ?? lesson.teacher.email} ·{" "}
                      {formatInZone(lesson.scheduledStart, timezone)} ·{" "}
                      {lessonDurationMinutes(
                        lesson.scheduledStart,
                        lesson.scheduledEnd,
                      )}{" "}
                      хв
                    </span>
                  </span>
                  <LessonStatusBadge status={lesson.status} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
