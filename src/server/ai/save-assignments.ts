import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DIFFICULTY_LABEL,
  generatedProblemSchema,
  type GeneratedProblem,
} from "@/server/ai/task-schema";
import { AssignmentSourceType, UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export class SaveAssignmentsError extends Error {}

export type SaveAssignmentsInput = {
  problems: GeneratedProblem[];
  lessonId: string | null;
  studentId: string | null;
  dueAt: Date | null;
  sourceType: AssignmentSourceType;
  sourcePageId: string | null;
  aiModel: string;
  aiPrompt: string;
};

function titleFor(problem: GeneratedProblem): string {
  const label = DIFFICULTY_LABEL[problem.difficulty];
  return `${problem.type} (${label})`.slice(0, 200);
}

/** Persist selected generated problems as `Assignment` rows for the teacher. */
export async function saveGeneratedAssignments(
  teacherId: string,
  input: SaveAssignmentsInput,
): Promise<{ count: number }> {
  const problems = input.problems.map((p) => generatedProblemSchema.parse(p));
  if (problems.length === 0) {
    throw new SaveAssignmentsError("Не обрано жодної задачі.");
  }

  if (input.lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: input.lessonId, teacherId },
      select: { id: true },
    });
    if (!lesson) throw new SaveAssignmentsError("Урок не знайдено.");
  }
  if (input.studentId) {
    const student = await prisma.user.findFirst({
      where: {
        id: input.studentId,
        tenantId: teacherId,
        role: UserRole.STUDENT,
      },
      select: { id: true },
    });
    if (!student) throw new SaveAssignmentsError("Учня не знайдено.");
  }
  if (input.sourcePageId) {
    const page = await prisma.page.findFirst({
      where: { id: input.sourcePageId, teacherId },
      select: { id: true },
    });
    if (!page) throw new SaveAssignmentsError("Сторінку-джерело не знайдено.");
  }

  const result = await prisma.assignment.createMany({
    data: problems.map((problem) => ({
      teacherId,
      lessonId: input.lessonId,
      studentId: input.studentId,
      title: titleFor(problem),
      description: problem.prompt,
      sourceType: input.sourceType,
      sourcePageId: input.sourcePageId,
      dueAt: input.dueAt,
      aiModel: input.aiModel,
      aiPrompt: input.aiPrompt.slice(0, 8000),
      metadataJson: {
        difficulty: problem.difficulty,
        type: problem.type,
        answer: problem.answer,
        example: problem.example,
        solutionSteps: problem.solutionSteps,
        hints: problem.hints,
      } as Prisma.InputJsonValue,
    })),
  });

  return { count: result.count };
}
