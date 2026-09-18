import "server-only";

import { prisma } from "@/lib/prisma";
import { z } from "zod";

import { SubmissionStatus } from "@/generated/prisma/enums";

/**
 * Assignment reads. Teachers see everything (including the AI solution stored in
 * `metadataJson`); students see only the statement and due date for assignments
 * on their own lessons.
 */

const metadataSchema = z
  .object({
    difficulty: z.string().optional(),
    type: z.string().optional(),
    answer: z.string().optional(),
    example: z.string().optional(),
    solutionSteps: z.array(z.string()).optional(),
    hints: z.array(z.string()).optional(),
  })
  .catch({});

export type AssignmentListItem = {
  id: string;
  title: string;
  dueAt: Date | null;
  type: string | null;
  difficulty: string | null;
  /** The most recent submission for this assignment, if any (a student may resubmit). */
  latestSubmission: {
    id: string;
    status: SubmissionStatus;
    score: number | null;
  } | null;
};

function toListItem(row: {
  id: string;
  title: string;
  dueAt: Date | null;
  metadataJson: unknown;
}): Omit<AssignmentListItem, "latestSubmission"> {
  const meta = metadataSchema.parse(row.metadataJson ?? {});
  return {
    id: row.id,
    title: row.title,
    dueAt: row.dueAt,
    type: meta.type ?? null,
    difficulty: meta.difficulty ?? null,
  };
}

/** Attaches each assignment's most recent submission (by `submittedAt`), if any. */
async function withLatestSubmission(
  rows: {
    id: string;
    title: string;
    dueAt: Date | null;
    metadataJson: unknown;
  }[],
): Promise<AssignmentListItem[]> {
  const base = rows.map(toListItem);
  if (base.length === 0) return [];

  const submissions = await prisma.submission.findMany({
    where: { assignmentId: { in: base.map((a) => a.id) } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      assignmentId: true,
      status: true,
      review: { select: { score: true } },
    },
  });

  const latestByAssignment = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    if (!latestByAssignment.has(s.assignmentId)) {
      latestByAssignment.set(s.assignmentId, s);
    }
  }

  return base.map((a) => {
    const latest = latestByAssignment.get(a.id);
    return {
      ...a,
      latestSubmission: latest
        ? { id: latest.id, status: latest.status, score: latest.review?.score ?? null }
        : null,
    };
  });
}

export async function listAssignmentsForTeacherLesson(
  teacherId: string,
  lessonId: string,
): Promise<AssignmentListItem[]> {
  const rows = await prisma.assignment.findMany({
    where: { teacherId, lessonId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, dueAt: true, metadataJson: true },
  });
  return withLatestSubmission(rows);
}

export async function listAssignmentsForStudentLesson(
  studentId: string,
  lessonId: string,
): Promise<AssignmentListItem[]> {
  const rows = await prisma.assignment.findMany({
    where: { lessonId, lesson: { studentId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, dueAt: true, metadataJson: true },
  });
  return withLatestSubmission(rows);
}

export type TeacherAssignment = {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  aiModel: string | null;
  lessonSubject: string | null;
  studentName: string | null;
  solution: {
    difficulty: string | null;
    type: string | null;
    answer: string | null;
    example: string | null;
    solutionSteps: string[];
    hints: string[];
  };
};

export async function getAssignmentForTeacher(
  teacherId: string,
  assignmentId: string,
): Promise<TeacherAssignment | null> {
  const row = await prisma.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      aiModel: true,
      studentId: true,
      metadataJson: true,
      lesson: { select: { subject: true } },
    },
  });
  if (!row) return null;

  // `Assignment.studentId` is a bare field (no relation) — look the name up,
  // scoped to this teacher's tenant so it can never read another tenant's user.
  const student = row.studentId
    ? await prisma.user.findFirst({
        where: { id: row.studentId, tenantId: teacherId },
        select: { name: true, email: true },
      })
    : null;

  const meta = metadataSchema.parse(row.metadataJson ?? {});
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    aiModel: row.aiModel,
    lessonSubject: row.lesson?.subject ?? null,
    studentName: student?.name ?? student?.email ?? null,
    solution: {
      difficulty: meta.difficulty ?? null,
      type: meta.type ?? null,
      answer: meta.answer ?? null,
      example: meta.example ?? null,
      solutionSteps: meta.solutionSteps ?? [],
      hints: meta.hints ?? [],
    },
  };
}

export type StudentAssignment = {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  lessonSubject: string | null;
};

export async function getAssignmentForStudent(
  studentId: string,
  assignmentId: string,
): Promise<StudentAssignment | null> {
  const row = await prisma.assignment.findFirst({
    where: { id: assignmentId, lesson: { studentId } },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      lesson: { select: { subject: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    lessonSubject: row.lesson?.subject ?? null,
  };
}
