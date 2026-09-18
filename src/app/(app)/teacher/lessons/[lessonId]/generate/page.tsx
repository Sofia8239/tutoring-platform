import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { getLessonForTeacher } from "@/server/lessons/lessons";
import { getWhiteboardForTeacher } from "@/server/lessons/whiteboard";
import { listTenantStudents } from "@/server/users/users";
import { isAiConfigured } from "@/server/ai/generate-tasks";
import { TaskGenerator } from "@/components/pages/task-generator";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "AI-генерація ДЗ з дошки" };

export default async function GenerateHomeworkFromLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await params;

  const [lesson, students, whiteboard] = await Promise.all([
    getLessonForTeacher(teacherId, lessonId),
    listTenantStudents(teacherId),
    getWhiteboardForTeacher(teacherId, lessonId),
  ]);
  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/teacher/lessons/${lessonId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроку
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI-генерація ДЗ з дошки
        </h1>
        <p className="text-muted text-sm">
          На основі того, що на дошці уроку «{lesson.subject}»
        </p>
      </div>

      {isAiConfigured() ? (
        <TaskGenerator
          pageId={null}
          lockedLessonId={lesson.id}
          whiteboardScene={whiteboard?.scene ?? null}
          lessons={[
            {
              id: lesson.id,
              subject: lesson.subject,
              studentId: lesson.student.id,
            },
          ]}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
          }))}
        />
      ) : (
        <p className="text-muted text-sm">
          AI-генерацію не налаштовано на сервері (не задано AI-провайдера).
        </p>
      )}
    </div>
  );
}
