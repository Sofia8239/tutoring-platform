import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { utcToZonedWallTime } from "@/lib/datetime";
import { getTeacherProfile, listTenantStudents } from "@/server/users/users";
import { listTeacherDisciplines } from "@/server/teacher/disciplines";
import { UserRole } from "@/generated/prisma/enums";

import { LessonForm } from "../lesson-form";

export const metadata: Metadata = { title: "Новий урок" };

const WALL_CLOCK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function nextFullHour(): Date {
  return new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
}

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { start } = await searchParams;

  const [students, profile, disciplines] = await Promise.all([
    listTenantStudents(teacherId),
    getTeacherProfile(teacherId),
    listTeacherDisciplines(teacherId),
  ]);
  const { timezone } = profile;

  const startValue =
    start && WALL_CLOCK_RE.test(start)
      ? start
      : utcToZonedWallTime(nextFullHour(), timezone);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/teacher/lessons"
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроків
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Новий урок</h1>
      </div>

      {students.length === 0 ? (
        <p className="text-muted text-sm">
          Спершу{" "}
          <Link href="/teacher" className="underline">
            запросіть учня
          </Link>
          , щоб призначити урок.
        </p>
      ) : (
        <LessonForm
          mode="create"
          students={students}
          disciplines={disciplines}
          timezone={timezone}
          initialValues={{
            studentId: "",
            subject: "",
            disciplineKey: "",
            start: startValue,
            durationMinutes: "60",
            price: "",
            notes: "",
            meetLink: profile.defaultMeetingUrl ?? "",
          }}
        />
      )}
    </div>
  );
}
