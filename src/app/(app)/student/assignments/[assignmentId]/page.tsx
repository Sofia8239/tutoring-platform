import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { getAssignmentForStudent } from "@/server/lessons/assignments";
import { listSubmissionsForStudentAssignment } from "@/server/lessons/submissions";
import { isR2Configured } from "@/server/storage/r2";
import { isAiConfigured } from "@/server/ai/generate-tasks";
import { SUBMISSION_STATUS_LABEL } from "@/lib/submission-display";
import { SubmitWorkForm } from "@/components/pages/submit-work-form";
import { Card, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Завдання" };

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { assignmentId } = await params;

  const [a, submissions] = await Promise.all([
    getAssignmentForStudent(user.id, assignmentId),
    listSubmissionsForStudentAssignment(user.id, assignmentId),
  ]);
  if (!a) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/student/lessons"
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроків
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
        <p className="text-muted text-xs">
          {a.lessonSubject ? `Урок: ${a.lessonSubject}` : ""}
          {a.dueAt ? ` · до ${a.dueAt.toLocaleDateString("uk-UA")}` : ""}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Умова</CardTitle>
        <p className="text-sm whitespace-pre-wrap">{a.description}</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Здати роботу</CardTitle>
        <SubmitWorkForm assignmentId={a.id} uploadsEnabled={isR2Configured()} />
        {isAiConfigured() ? (
          <p className="text-muted text-xs">
            Після здачі роботу автоматично перевірить AI.
          </p>
        ) : null}
      </Card>

      {submissions.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>Мої здачі</CardTitle>
          <ul className="divide-line border-line rounded-btn divide-y border text-sm">
            {submissions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/student/submissions/${s.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between px-3 py-2"
                >
                  <span>
                    {s.submittedAt.toLocaleString("uk-UA")}
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
        </Card>
      ) : null}
    </div>
  );
}
