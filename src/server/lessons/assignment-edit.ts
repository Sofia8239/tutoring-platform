import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AiError, getAiProvider } from "@/server/ai/provider";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  generatedProblemSchema,
  type GeneratedProblem,
} from "@/server/ai/task-schema";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Teacher-side editing of a (usually AI-generated) assignment: manual field
 * edits, and AI refinement ("make it harder", "swap the numbers", "add a
 * hint") that rewrites the task + solution and saves immediately.
 */

export class AssignmentEditError extends Error {}

const MAX_TITLE = 200;

const metaSchema = z
  .object({
    difficulty: z.string().optional(),
    type: z.string().optional(),
    answer: z.string().optional(),
    example: z.string().optional(),
    solutionSteps: z.array(z.string()).optional(),
    hints: z.array(z.string()).optional(),
  })
  .catch({});

export type AssignmentContent = {
  title: string;
  description: string;
  difficulty: (typeof DIFFICULTIES)[number] | null;
  type: string;
  answer: string;
  example: string;
  solutionSteps: string[];
  hints: string[];
};

function readContent(row: {
  title: string;
  description: string;
  metadataJson: unknown;
}): AssignmentContent {
  const m = metaSchema.parse(row.metadataJson ?? {});
  const difficulty = DIFFICULTIES.find((d) => d === m.difficulty) ?? null;
  return {
    title: row.title,
    description: row.description,
    difficulty,
    type: m.type ?? "",
    answer: m.answer ?? "",
    example: m.example ?? "",
    solutionSteps: m.solutionSteps ?? [],
    hints: m.hints ?? [],
  };
}

export async function getAssignmentContent(
  teacherId: string,
  assignmentId: string,
): Promise<AssignmentContent | null> {
  const row = await prisma.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    select: { title: true, description: true, metadataJson: true },
  });
  return row ? readContent(row) : null;
}

export type UpdateAssignmentInput = {
  title?: string;
  description?: string;
  difficulty?: (typeof DIFFICULTIES)[number];
  type?: string;
  answer?: string;
  example?: string;
  solutionSteps?: string[];
  hints?: string[];
};

async function writeContent(
  teacherId: string,
  assignmentId: string,
  patch: UpdateAssignmentInput,
): Promise<AssignmentContent> {
  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    select: { title: true, description: true, metadataJson: true },
  });
  if (!existing) throw new AssignmentEditError("Завдання не знайдено.");

  const current = readContent(existing);
  const next: AssignmentContent = {
    title: (patch.title ?? current.title).trim().slice(0, MAX_TITLE),
    description: (patch.description ?? current.description).trim(),
    difficulty: patch.difficulty ?? current.difficulty,
    type: (patch.type ?? current.type).trim(),
    answer: (patch.answer ?? current.answer).trim(),
    example: (patch.example ?? current.example).trim(),
    solutionSteps: (patch.solutionSteps ?? current.solutionSteps)
      .map((s) => s.trim())
      .filter(Boolean),
    hints: (patch.hints ?? current.hints).map((s) => s.trim()).filter(Boolean),
  };
  if (!next.title)
    throw new AssignmentEditError("Назва не може бути порожньою.");
  if (!next.description) {
    throw new AssignmentEditError("Умова не може бути порожньою.");
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: next.title,
      description: next.description,
      metadataJson: {
        difficulty: next.difficulty,
        type: next.type,
        answer: next.answer,
        example: next.example,
        solutionSteps: next.solutionSteps,
        hints: next.hints,
      } as Prisma.InputJsonValue,
    },
  });
  return next;
}

export function updateAssignmentContent(
  teacherId: string,
  assignmentId: string,
  patch: UpdateAssignmentInput,
): Promise<AssignmentContent> {
  return writeContent(teacherId, assignmentId, patch);
}

const REFINE_SYSTEM = `Ти — досвідчений методист. Тобі дають наявне навчальне\
 завдання (умову й розвʼязання) та інструкцію викладача, як його змінити.\
 Поверни ОНОВЛЕНЕ завдання ПОВНІСТЮ у тому самому форматі: умова, тип,\
 складність, коротка відповідь, приклад іншої схожої розвʼязаної задачі,\
 покрокове розвʼязання, 1–3 підказки. Мова — українська. Зберігай тему й\
 навчальну мету, зміни лише те, що просить викладач.`;

export async function refineAssignmentWithAi(
  teacherId: string,
  assignmentId: string,
  instruction: string,
): Promise<AssignmentContent> {
  const trimmed = instruction.trim();
  if (!trimmed) throw new AssignmentEditError("Вкажіть, що змінити.");

  const provider = getAiProvider();
  if (!provider) {
    throw new AiError("AI не налаштовано на сервері.");
  }

  const current = await getAssignmentContent(teacherId, assignmentId);
  if (!current) throw new AssignmentEditError("Завдання не знайдено.");

  const currentProblem: GeneratedProblem = {
    prompt: current.description,
    type: current.type || "завдання",
    difficulty: current.difficulty ?? "medium",
    answer: current.answer || "—",
    example: current.example || "—",
    solutionSteps: current.solutionSteps.length ? current.solutionSteps : ["—"],
    hints: current.hints,
  };

  const { value } = await provider.generateStructured({
    schema: generatedProblemSchema,
    schemaName: "refined_problem",
    system: REFINE_SYSTEM,
    prompt: `Наявне завдання (JSON):\n${JSON.stringify(currentProblem, null, 2)}\n\nІнструкція викладача:\n${trimmed}`,
  });

  return writeContent(teacherId, assignmentId, {
    description: value.prompt,
    difficulty: value.difficulty,
    type: value.type,
    answer: value.answer,
    example: value.example,
    solutionSteps: value.solutionSteps,
    hints: value.hints,
  });
}

export { DIFFICULTIES, DIFFICULTY_LABEL };
