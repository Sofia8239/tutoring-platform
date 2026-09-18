import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { utcToZonedWallTime } from "@/lib/datetime";
import { toMajorString } from "@/lib/money";
import { lessonDurationMinutes } from "@/lib/lesson-display";
import { getUserTimezone, listTenantStudents } from "@/server/users/users";
import { getLessonForTeacher } from "@/server/lessons/lessons";
import { listTeacherDisciplines } from "@/server/teacher/disciplines";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";

import { LessonForm } from "../../lesson-form";

export const metadata: Metadata = { title: "Редагувати урок" };

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await params;

  const [lesson, students, timezone, disciplines] = await Promise.all([
    getLessonForTeacher(teacherId, lessonId),
    listTenantStudents(teacherId),
    getUserTimezone(user.id),
    listTeacherDisciplines(teacherId),
  ]);

  if (!lesson) notFound();
  if (lesson.status !== LessonStatus.SCHEDULED) {
    redirect(`/teacher/lessons/${lessonId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/teacher/lessons/${lessonId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроку
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Редагувати урок
        </h1>
      </div>

      <LessonForm
        mode="edit"
        lessonId={lesson.id}
        students={students}
        disciplines={disciplines}
        timezone={timezone}
        initialValues={{
          studentId: lesson.student.id,
          subject: lesson.subject,
          disciplineKey: lesson.disciplineKey ?? "",
          start: utcToZonedWallTime(lesson.scheduledStart, timezone),
          durationMinutes: String(
            lessonDurationMinutes(lesson.scheduledStart, lesson.scheduledEnd),
          ),
          price: lesson.price > 0 ? toMajorString(lesson.price) : "",
          notes: lesson.notes ?? "",
          meetLink: lesson.meetLink ?? "",
        }}
      />
    </div>
  );
}
