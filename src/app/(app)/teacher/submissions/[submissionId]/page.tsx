import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { getSubmissionForTeacher } from "@/server/lessons/submissions";
import { getAssignmentForTeacher } from "@/server/lessons/assignments";
import { isAiConfigured } from "@/server/ai/generate-tasks";
import { SUBMISSION_STATUS_LABEL } from "@/lib/submission-display";
import { ReviewPanel } from "@/components/review-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";

import { RereviewButton } from "./rereview-button";

export const metadata: Metadata = { title: "Здача" };

export default async function TeacherSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { submissionId } = await params;

  const s = await getSubmissionForTeacher(teacherId, submissionId);
  if (!s) notFound();

  const assignment = await getAssignmentForTeacher(teacherId, s.assignmentId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/teacher/assignments/${s.assignmentId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До завдання
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {s.assignmentTitle}
        </h1>
        <p className="text-muted text-xs">
          {s.studentName} · {s.submittedAt.toLocaleString("uk-UA")} ·{" "}
          {SUBMISSION_STATUS_LABEL[s.status]}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Робота учня</CardTitle>
        {s.text ? (
          <p className="text-sm whitespace-pre-wrap">{s.text}</p>
        ) : null}
        {s.fileUrl ? (
          <a
            href={s.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary w-fit text-sm underline"
          >
            Відкрити файл
          </a>
        ) : null}
        {!s.text && !s.fileUrl ? <p className="text-muted text-sm">—</p> : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>AI-перевірка</CardTitle>
        {s.review ? (
          <ReviewPanel review={s.review} />
        ) : (
          <p className="text-muted text-sm">
            {s.status === "REVIEWING"
              ? "Перевірка триває…"
              : "Перевірки ще немає."}
          </p>
        )}
        {isAiConfigured() ? <RereviewButton submissionId={s.id} /> : null}
      </Card>

      {assignment ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>Еталон</CardTitle>
          {assignment.solution.answer ? (
            <p className="text-sm">
              <span className="font-medium">Відповідь: </span>
              {assignment.solution.answer}
            </p>
          ) : null}
          {assignment.solution.solutionSteps.length > 0 ? (
            <ol className="list-decimal pl-5 text-sm">
              {assignment.solution.solutionSteps.map((step, i) => (
                <li key={i} className="whitespace-pre-wrap">
                  {step}
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
