import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { getPageForTeacher } from "@/server/pages/pages";
import { listLessonsForTeacher } from "@/server/lessons/lessons";
import { listTenantStudents } from "@/server/users/users";
import { isAiConfigured } from "@/server/ai/generate-tasks";
import { TaskGenerator } from "@/components/pages/task-generator";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "AI-генерація завдань" };

export default async function GenerateTasksPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { pageId } = await params;

  const [page, lessons, students] = await Promise.all([
    getPageForTeacher(teacherId, pageId),
    listLessonsForTeacher(teacherId, { scope: "all" }),
    listTenantStudents(teacherId),
  ]);
  if (!page) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/teacher/pages/${pageId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До сторінки
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI-генерація завдань
        </h1>
        <p className="text-muted text-sm">На основі конспекту «{page.title}»</p>
      </div>

      {isAiConfigured() ? (
        <TaskGenerator
          pageId={page.id}
          lessons={lessons.map((l) => ({
            id: l.id,
            subject: l.subject,
            studentId: l.student.id,
          }))}
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
