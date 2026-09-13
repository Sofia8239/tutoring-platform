import "server-only";

import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
};

function toListItem(row: {
  id: string;
  title: string;
  dueAt: Date | null;
  metadataJson: unknown;
}): AssignmentListItem {
  const meta = metadataSchema.parse(row.metadataJson ?? {});
  return {
    id: row.id,
    title: row.title,
    dueAt: row.dueAt,
    type: meta.type ?? null,
    difficulty: meta.difficulty ?? null,
  };
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
  return rows.map(toListItem);
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
  return rows.map(toListItem);
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
