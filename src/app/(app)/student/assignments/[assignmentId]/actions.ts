"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildSubmissionKey, validateUpload } from "@/lib/upload";
import { createUploadUrl, isR2Configured } from "@/server/storage/r2";
import {
  createSubmission,
  SubmissionError,
} from "@/server/lessons/submissions";
import { runAutoReview } from "@/server/ai/review-submission";
import { UserRole } from "@/generated/prisma/enums";

async function assertAssignmentForStudent(
  studentId: string,
  assignmentId: string,
): Promise<{ teacherId: string }> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, lesson: { studentId } },
    select: { teacherId: true },
  });
  if (!assignment) throw new SubmissionError("Завдання не знайдено.");
  return assignment;
}

export type UploadUrlResult =
  { ok: true; uploadUrl: string; key: string } | { ok: false; error: string };

export async function requestUploadAction(input: {
  assignmentId: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<UploadUrlResult> {
  const user = await requireRole(UserRole.STUDENT);

  if (!isR2Configured()) {
    return { ok: false, error: "Завантаження файлів не налаштоване." };
  }

  const valid = validateUpload({
    contentType: input.contentType,
    size: input.size,
  });
  if (!valid.ok) return { ok: false, error: valid.error };

  try {
    const { teacherId } = await assertAssignmentForStudent(
      user.id,
      input.assignmentId,
    );
    const key = buildSubmissionKey({ teacherId, filename: input.filename });
    const uploadUrl = await createUploadUrl({
      key,
      contentType: input.contentType,
    });
    return { ok: true, uploadUrl, key };
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export type SubmitResult =
  | {
      ok: true;
      submissionId: string;
      review: "reviewed" | "skipped" | "failed";
    }
  | { ok: false; error: string };

export async function submitAssignmentAction(input: {
  assignmentId: string;
  text: string;
  fileKey: string | null;
  fileType: string | null;
}): Promise<SubmitResult> {
  const user = await requireRole(UserRole.STUDENT);

  let submissionId: string;
  try {
    const created = await createSubmission({
      studentId: user.id,
      assignmentId: input.assignmentId,
      text: input.text,
      fileKey: input.fileKey,
      fileType: input.fileType,
    });
    submissionId = created.id;
  } catch (error) {
    if (error instanceof SubmissionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  // Auto AI review — never blocks the submission. Scoped to this student.
  const outcome = await runAutoReview(submissionId, { studentId: user.id });

  revalidatePath(`/student/assignments/${input.assignmentId}`);
  revalidatePath(`/teacher/assignments/${input.assignmentId}`);
  return { ok: true, submissionId, review: outcome.status };
}
