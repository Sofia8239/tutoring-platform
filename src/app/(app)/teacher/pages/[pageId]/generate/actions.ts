"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { tiptapToPlainText } from "@/lib/tiptap-text";
import { whiteboardToPlainText } from "@/lib/whiteboard-text";
import { getPageForTeacher } from "@/server/pages/pages";
import { getWhiteboardForTeacher } from "@/server/lessons/whiteboard";
import {
  AiError,
  generateTasks,
  isAiConfigured,
} from "@/server/ai/generate-tasks";
import {
  saveGeneratedAssignments,
  SaveAssignmentsError,
} from "@/server/ai/save-assignments";
import type { GeneratedProblem } from "@/server/ai/task-schema";
import { AssignmentSourceType, UserRole } from "@/generated/prisma/enums";

export type GenerateState =
  | {
      ok: true;
      problems: GeneratedProblem[];
      model: string;
      promptUsed: string;
    }
  | { ok: false; error: string }
  | { ok: null };

export type GenerateInput = {
  pageId: string;
  lessonId: string | null;
  includeWhiteboard: boolean;
  instructions: string;
  count: number;
  difficulty: "mixed" | "easy" | "medium" | "hard";
};

export async function generateTasksAction(
  input: GenerateInput,
): Promise<GenerateState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  if (!isAiConfigured()) {
    return { ok: false, error: "AI-генерацію не налаштовано на сервері." };
  }

  const page = await getPageForTeacher(teacherId, input.pageId);
  if (!page) return { ok: false, error: "Сторінку не знайдено." };

  const sources: string[] = [];
  const pageText = tiptapToPlainText(page.contentJson);
  if (pageText) sources.push(`Конспект «${page.title}»:\n${pageText}`);

  if (input.includeWhiteboard && input.lessonId) {
    const board = await getWhiteboardForTeacher(teacherId, input.lessonId);
    const boardText = board ? whiteboardToPlainText(board.scene) : "";
    if (boardText) sources.push(`Дошка уроку:\n${boardText}`);
  }

  const sourceText = sources.join("\n\n---\n\n");
  if (!sourceText.trim() && !input.instructions.trim()) {
    return {
      ok: false,
      error: "Немає матеріалу: конспект порожній і немає вказівок.",
    };
  }

  try {
    const result = await generateTasks({
      sourceText: sourceText || input.instructions,
      instructions: input.instructions,
      count: input.count,
      difficulty: input.difficulty,
    });
    return {
      ok: true,
      problems: result.taskSet.problems,
      model: result.model,
      promptUsed: result.promptUsed,
    };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    throw error;
  }
}

export type SaveState =
  { ok: true; count: number } | { ok: false; error: string } | { ok: null };

export type SaveInput = {
  pageId: string;
  problems: GeneratedProblem[];
  lessonId: string | null;
  studentId: string | null;
  dueAt: string | null;
  aiModel: string;
  aiPrompt: string;
};

export async function saveTasksAction(input: SaveInput): Promise<SaveState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  try {
    const { count } = await saveGeneratedAssignments(teacherId, {
      problems: input.problems,
      lessonId: input.lessonId,
      studentId: input.studentId,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      sourceType: AssignmentSourceType.PAGE,
      sourcePageId: input.pageId,
      aiModel: input.aiModel,
      aiPrompt: input.aiPrompt,
    });

    revalidatePath("/teacher/pages");
    if (input.lessonId) revalidatePath(`/teacher/lessons/${input.lessonId}`);
    return { ok: true, count };
  } catch (error) {
    if (error instanceof SaveAssignmentsError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
