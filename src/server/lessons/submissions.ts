import "server-only";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createDownloadUrl, isR2Configured } from "@/server/storage/r2";
import { SubmissionStatus } from "@/generated/prisma/enums";

/**
 * Homework submissions. Each hand-in is a new `Submission` row (history);
 * scoped by the participating student / owning teacher.
 */

export class SubmissionError extends Error {}

const reviewMetaSchema = z
  .object({
    errors: z
      .array(
        z.object({
          location: z.string(),
          type: z.string(),
          explanation: z.string(),
          severity: z.string(),
        }),
      )
      .catch([]),
    score: z.number().nullable().catch(null),
    summary: z.string().catch(""),
    model: z.string().catch(""),
  })
  .catch({ errors: [], score: null, summary: "", model: "" });

export type SubmissionListItem = {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date;
  hasFile: boolean;
  score: number | null;
  reviewed: boolean;
};

export type ReviewView = {
  errors: {
    location: string;
    type: string;
    explanation: string;
    severity: string;
  }[];
  score: number | null;
  summary: string;
  model: string;
} | null;

export type SubmissionDetail = {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date;
  text: string | null;
  fileUrl: string | null;
  fileType: string | null;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string | null;
  review: ReviewView;
};

function toListItem(row: {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date;
  fileUrl: string | null;
  review: { score: number | null } | null;
}): SubmissionListItem {
  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submittedAt,
    hasFile: Boolean(row.fileUrl),
    score: row.review?.score ?? null,
    reviewed: Boolean(row.review),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createSubmission(input: {
  studentId: string;
  assignmentId: string;
  text: string | null;
  fileKey: string | null;
  fileType: string | null;
}): Promise<{ id: string }> {
  if (!input.text?.trim() && !input.fileKey) {
    throw new SubmissionError("Додайте текст або файл.");
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: input.assignmentId, lesson: { studentId: input.studentId } },
    select: { id: true, teacherId: true, lessonId: true, dueAt: true },
  });
  if (!assignment) {
    throw new SubmissionError("Завдання не знайдено.");
  }

  const late =
    assignment.dueAt != null && assignment.dueAt.getTime() < Date.now();

  const submission = await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      teacherId: assignment.teacherId,
      studentId: input.studentId,
      lessonId: assignment.lessonId,
      text: input.text?.trim() || null,
      fileUrl: input.fileKey,
      fileType: input.fileType,
      status: late ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
    },
    select: { id: true },
  });
  return submission;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listSubmissionsForTeacherAssignment(
  teacherId: string,
  assignmentId: string,
): Promise<(SubmissionListItem & { studentName: string | null })[]> {
  const rows = await prisma.submission.findMany({
    where: { teacherId, assignmentId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      fileUrl: true,
      review: { select: { score: true } },
      student: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    ...toListItem(row),
    studentName: row.student.name ?? row.student.email,
  }));
}

export async function listSubmissionsForStudentAssignment(
  studentId: string,
  assignmentId: string,
): Promise<SubmissionListItem[]> {
  const rows = await prisma.submission.findMany({
    where: { studentId, assignmentId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      fileUrl: true,
      review: { select: { score: true } },
    },
  });
  return rows.map(toListItem);
}

async function toDetail(row: {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date;
  text: string | null;
  fileUrl: string | null;
  fileType: string | null;
  assignment: { id: string; title: string };
  student: { name: string | null; email: string };
  review: {
    errorsJson: unknown;
    score: number | null;
    summary: string;
    model: string;
  } | null;
}): Promise<SubmissionDetail> {
  let fileUrl: string | null = null;
  if (row.fileUrl && isR2Configured()) {
    fileUrl = await createDownloadUrl(row.fileUrl).catch(() => null);
  }

  let review: ReviewView = null;
  if (row.review) {
    const meta = reviewMetaSchema.parse({
      errors: row.review.errorsJson,
      score: row.review.score,
      summary: row.review.summary,
      model: row.review.model,
    });
    review = {
      errors: meta.errors,
      score: meta.score,
      summary: meta.summary,
      model: meta.model,
    };
  }

  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submittedAt,
    text: row.text,
    fileUrl,
    fileType: row.fileType,
    assignmentId: row.assignment.id,
    assignmentTitle: row.assignment.title,
    studentName: row.student.name ?? row.student.email,
    review,
  };
}

const detailSelect = {
  id: true,
  status: true,
  submittedAt: true,
  text: true,
  fileUrl: true,
  fileType: true,
  assignment: { select: { id: true, title: true } },
  student: { select: { name: true, email: true } },
  review: {
    select: {
      errorsJson: true,
      score: true,
      summary: true,
      model: true,
    },
  },
} as const;

export async function getSubmissionForTeacher(
  teacherId: string,
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const row = await prisma.submission.findFirst({
    where: { id: submissionId, teacherId },
    select: detailSelect,
  });
  return row ? toDetail(row) : null;
}

export async function getSubmissionForStudent(
  studentId: string,
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const row = await prisma.submission.findFirst({
    where: { id: submissionId, studentId },
    select: detailSelect,
  });
  return row ? toDetail(row) : null;
}
