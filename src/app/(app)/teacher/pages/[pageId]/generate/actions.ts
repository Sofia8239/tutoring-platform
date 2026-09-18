"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { tiptapToPlainText } from "@/lib/tiptap-text";
import { whiteboardToPlainText } from "@/lib/whiteboard-text";
import { getPageForTeacher } from "@/server/pages/pages";
import { getWhiteboardForTeacher } from "@/server/lessons/whiteboard";
import { getLessonForTeacher } from "@/server/lessons/lessons";
import { resolveSubjectLabel } from "@/server/teacher/disciplines";
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
import { DEFAULT_INSTRUCTION_LANGUAGE } from "@/lib/ai-context";
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

/** Same shape/limits as the whiteboard-image PDF export. */
const IMAGE_DATA_URL_RE = /^data:(image\/(?:png|jpeg));base64,(.+)$/;
const MAX_IMAGE_CHARS = 12_000_000; // ~9 MB decoded

function parseImageDataUrl(
  dataUrl: string,
): { base64: string; mediaType: string } | null {
  if (dataUrl.length > MAX_IMAGE_CHARS) return null;
  const match = dataUrl.match(IMAGE_DATA_URL_RE);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

export type GenerateInput = {
  /** null when generating straight from a lesson's whiteboard, no conspect. */
  pageId: string | null;
  lessonId: string | null;
  includeWhiteboard: boolean;
  /** A PNG/JPEG data URL of the whiteboard, captured client-side — this is
   *  how hand-drawn content reaches the AI (plain-text extraction only ever
   *  sees typed text shapes). */
  boardImageDataUrl?: string | null;
  instructions: string;
  count: number;
  difficulty: "mixed" | "easy" | "medium" | "hard";
  /** e.g. "6 клас" — optional, calibrates difficulty/vocabulary. */
  level?: string;
  /** e.g. "практичні вправи", "контрольні питання" — optional, left to the AI when unset. */
  taskType?: string;
};

export async function generateTasksAction(
  input: GenerateInput,
): Promise<GenerateState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  if (!isAiConfigured()) {
    return { ok: false, error: "AI-генерацію не налаштовано на сервері." };
  }

  const page = input.pageId
    ? await getPageForTeacher(teacherId, input.pageId)
    : null;
  if (input.pageId && !page) {
    return { ok: false, error: "Сторінку не знайдено." };
  }

  const sources: string[] = [];
  if (page) {
    const pageText = tiptapToPlainText(page.contentJson);
    if (pageText) sources.push(`Конспект «${page.title}»:\n${pageText}`);
  }

  if (input.includeWhiteboard && input.lessonId) {
    const board = await getWhiteboardForTeacher(teacherId, input.lessonId);
    const boardText = board ? whiteboardToPlainText(board.scene) : "";
    if (boardText) sources.push(`Дошка уроку:\n${boardText}`);
  }

  let boardImage: { base64: string; mediaType: string } | null = null;
  if (input.boardImageDataUrl) {
    boardImage = parseImageDataUrl(input.boardImageDataUrl);
    if (!boardImage) {
      return { ok: false, error: "Некоректне зображення дошки." };
    }
  }

  const sourceText = sources.join("\n\n---\n\n");
  if (!sourceText.trim() && !input.instructions.trim() && !boardImage) {
    return {
      ok: false,
      error: "Немає матеріалу: конспект і дошка порожні, і немає вказівок.",
    };
  }

  const lesson = input.lessonId
    ? await getLessonForTeacher(teacherId, input.lessonId)
    : null;
  const subjectLabel = await resolveSubjectLabel(
    teacherId,
    lesson?.subject ?? null,
  );

  try {
    const result = await generateTasks({
      sourceText: sourceText || input.instructions,
      instructions: input.instructions,
      count: input.count,
      difficulty: input.difficulty,
      context: {
        subjectLabel,
        level: input.level?.trim() || null,
        taskType: input.taskType?.trim() || null,
        instructionLanguage: DEFAULT_INSTRUCTION_LANGUAGE,
      },
      boardImage,
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
  pageId: string | null;
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
      sourceType: input.pageId
        ? AssignmentSourceType.PAGE
        : AssignmentSourceType.WHITEBOARD,
      sourcePageId: input.pageId,
      aiModel: input.aiModel,
      aiPrompt: input.aiPrompt,
    });

    if (input.pageId) revalidatePath("/teacher/pages");
    if (input.lessonId) revalidatePath(`/teacher/lessons/${input.lessonId}`);
    return { ok: true, count };
  } catch (error) {
    if (error instanceof SaveAssignmentsError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
