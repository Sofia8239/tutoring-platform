import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { getSubmissionForStudent } from "@/server/lessons/submissions";
import { SUBMISSION_STATUS_LABEL } from "@/lib/submission-display";
import { ReviewPanel } from "@/components/review-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Здача" };

export default async function StudentSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { submissionId } = await params;

  const s = await getSubmissionForStudent(user.id, submissionId);
  if (!s) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/student/assignments/${s.assignmentId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До завдання
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {s.assignmentTitle}
        </h1>
        <p className="text-muted text-xs">
          {s.submittedAt.toLocaleString("uk-UA")} ·{" "}
          {SUBMISSION_STATUS_LABEL[s.status]}
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <CardTitle>Моя робота</CardTitle>
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
      </Card>
    </div>
  );
}
