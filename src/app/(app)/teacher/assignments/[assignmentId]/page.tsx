import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { getAssignmentForTeacher } from "@/server/lessons/assignments";
import { getAssignmentContent } from "@/server/lessons/assignment-edit";
import { listSubmissionsForTeacherAssignment } from "@/server/lessons/submissions";
import { isAiConfigured } from "@/server/ai/provider";
import { SUBMISSION_STATUS_LABEL } from "@/lib/submission-display";
import { AssignmentEditor } from "@/components/assignments/assignment-editor";
import { Card, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Завдання" };

export default async function TeacherAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { assignmentId } = await params;

  const [a, content, submissions] = await Promise.all([
    getAssignmentForTeacher(teacherId, assignmentId),
    getAssignmentContent(teacherId, assignmentId),
    listSubmissionsForTeacherAssignment(teacherId, assignmentId),
  ]);
  if (!a || !content) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/teacher/lessons"
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроків
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
        <p className="text-muted text-xs">
          {a.lessonSubject ? `урок: ${a.lessonSubject}` : ""}
          {a.studentName ? ` · учень: ${a.studentName}` : ""}
          {a.dueAt ? ` · до ${a.dueAt.toLocaleDateString("uk-UA")}` : ""}
          {a.aiModel ? ` · ${a.aiModel}` : ""}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle>Завдання та приклад виконання</CardTitle>
        <AssignmentEditor
          assignmentId={assignmentId}
          initial={content}
          aiEnabled={isAiConfigured()}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Здачі</CardTitle>
        {submissions.length === 0 ? (
          <p className="text-muted text-sm">Здач ще немає.</p>
        ) : (
          <ul className="divide-line border-line rounded-btn divide-y border text-sm">
            {submissions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/submissions/${s.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between px-3 py-2"
                >
                  <span>
                    {s.studentName} · {s.submittedAt.toLocaleString("uk-UA")}
                    {s.hasFile ? " · файл" : ""}
                  </span>
                  <span className="text-muted">
                    {SUBMISSION_STATUS_LABEL[s.status]}
                    {s.score !== null ? ` · ${s.score}/100` : ""}
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
