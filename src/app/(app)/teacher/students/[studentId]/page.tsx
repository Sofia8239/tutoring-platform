import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatInZone } from "@/lib/datetime";
import { lessonDurationMinutes } from "@/lib/lesson-display";
import { displayEmail } from "@/lib/manual-student";
import type { LessonMaterialFlags } from "@/lib/lesson-materials";
import { prisma } from "@/lib/prisma";
import { getUserTimezone } from "@/server/users/users";
import { listLessonsForTeacher, type LessonDTO } from "@/server/lessons/lessons";
import { listLessonMaterialFlags } from "@/server/lessons/lesson-materials";
import { LessonStatusBadge } from "@/components/lesson-status-badge";
import { LessonMaterialBadges } from "@/components/lessons/lesson-material-badges";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Кабінет учня" };

export default async function TeacherStudentCabinetPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { studentId } = await params;

  // Scope check: this student must belong to the requesting teacher's tenant
  // — a teacher can never open another teacher's student cabinet this way.
  const student = await prisma.user.findFirst({
    where: { id: studentId, tenantId: teacherId, role: UserRole.STUDENT },
    select: { id: true, name: true, email: true, isRegistered: true },
  });
  if (!student) notFound();

  const [upcoming, past, timezone] = await Promise.all([
    listLessonsForTeacher(teacherId, { scope: "upcoming", studentId }),
    listLessonsForTeacher(teacherId, { scope: "past", studentId }),
    getUserTimezone(user.id),
  ]);
  const materials = await listLessonMaterialFlags(
    teacherId,
    [...upcoming, ...past].map((l) => l.id),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/teacher/students"
          className="text-muted hover:text-ink text-sm"
        >
          ← До моїх учнів
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {student.name ?? "Учень"}
          </h1>
          {!student.isRegistered ? (
            <Badge tone="neutral">без кабінету</Badge>
          ) : null}
        </div>
        <span className="text-muted text-sm">
          {displayEmail(student.email) || "—"}
        </span>
      </div>

      <LessonGroup
        title="Найближчі"
        lessons={upcoming}
        timezone={timezone}
        materials={materials}
        empty="Запланованих уроків поки немає."
      />
      <LessonGroup
        title="Минулі"
        lessons={past}
        timezone={timezone}
        materials={materials}
        empty="Минулих уроків ще немає."
      />
    </div>
  );
}

function LessonGroup({
  title,
  lessons,
  timezone,
  materials,
  empty,
}: {
  title: string;
  lessons: LessonDTO[];
  timezone: string;
  materials: Map<string, LessonMaterialFlags>;
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
              <Link href={`/teacher/lessons/${lesson.id}`} className="block">
                <Card className="hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {lesson.subject}
                    </span>
                    <span className="text-muted text-xs">
                      {formatInZone(lesson.scheduledStart, timezone)} ·{" "}
                      {lessonDurationMinutes(
                        lesson.scheduledStart,
                        lesson.scheduledEnd,
                      )}{" "}
                      хв
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <LessonMaterialBadges flags={materials.get(lesson.id)} />
                    <LessonStatusBadge status={lesson.status} />
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
