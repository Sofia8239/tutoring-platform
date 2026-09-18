import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_INSTRUCTION_LANGUAGE,
  describeDisciplineContext,
  type DisciplineContext,
} from "@/lib/ai-context";
import { AiError, getAiProvider, isAiConfigured } from "@/server/ai/provider";
import { reviewSchema, type SubmissionReview } from "@/server/ai/review-schema";
import { isR2Configured, fetchObjectBase64 } from "@/server/storage/r2";
import { resolveSubjectLabel } from "@/server/teacher/disciplines";
import { SubmissionStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * AI review of a student submission (golden rule 5: structured JSON, Zod).
 * Reads the submission text and/or the uploaded photo/PDF (via R2) plus the
 * assignment's expected answer, and returns a list of located errors + score.
 *
 * Subject-neutral by construction: the system prompt is built from the
 * caller's `DisciplineContext` instead of a fixed math error taxonomy — the
 * model picks error categories that fit the subject (arithmetic/formula for
 * exact sciences, grammar/style for languages, etc.), or infers the subject
 * itself when no context is available.
 */

const assignmentMetaSchema = z
  .object({
    type: z.string().optional(),
    answer: z.string().optional(),
    solutionSteps: z.array(z.string()).optional(),
  })
  .catch({});

function buildReviewSystemPrompt(context: DisciplineContext): string {
  return `Ти — уважний і доброзичливий репетитор, що перевіряє домашню роботу\
 учня. ${describeDisciplineContext(context)}\n\
Порівняй роботу з умовою та еталонною відповіддю. Знайди КОНКРЕТНІ помилки:\
 для кожної вкажи де саме (крок / рядок / частина), тип помилки — сформулюй\
 його природною мовою, доречною саме для цього предмета (наприклад, для\
 точних наук: обчислення, формула, логіка; для мов: граматика, лексика,\
 стиль; для гуманітарних предметів: фактаж, аргументація — обери підхожі\
 категорії сам, якщо предмет інший), пояснення зрозумілою учневі мовою та\
 серйозність. Постав оцінку 0–100 (або null, якщо оцінити неможливо) і дай\
 короткий підсумок. Якщо помилок немає — поверни порожній масив errors і це\
 відзнач у summary.`;
}

type ReviewInput = {
  context: DisciplineContext;
  assignmentTitle: string;
  assignmentDescription: string;
  expectedAnswer: string | null;
  expectedSteps: string[];
  submissionText: string | null;
  file: { base64: string; mediaType: string } | null;
};

export type ReviewResult = {
  review: SubmissionReview;
  model: string;
  promptUsed: string;
  usage: { inputTokens: number; outputTokens: number };
};

function buildPrompt(input: ReviewInput): string {
  const parts = [
    `Завдання: ${input.assignmentTitle}`,
    `Умова:\n${input.assignmentDescription}`,
    input.expectedAnswer
      ? `Очікувана відповідь: ${input.expectedAnswer}`
      : null,
    input.expectedSteps.length
      ? `Еталонні кроки:\n${input.expectedSteps
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}`
      : null,
    input.submissionText
      ? `Робота учня (текст):\n"""\n${input.submissionText}\n"""`
      : input.file
        ? "Робота учня — у прикріпленому файлі."
        : "Учень не надав роботи.",
  ].filter((p): p is string => Boolean(p));
  return parts.join("\n\n");
}

async function callReview(input: ReviewInput): Promise<ReviewResult> {
  const provider = getAiProvider();
  if (!provider) {
    throw new AiError("AI-перевірку не налаштовано на сервері.");
  }

  const promptUsed = buildPrompt(input);
  const { value, model, usage } = await provider.generateStructured({
    schema: reviewSchema,
    schemaName: "homework_review",
    system: buildReviewSystemPrompt(input.context),
    prompt: promptUsed,
    files: input.file ? [input.file] : [],
  });

  return { review: value, model, promptUsed, usage };
}

async function persistReview(
  teacherId: string,
  submissionId: string,
  result: ReviewResult,
): Promise<void> {
  const data = {
    teacherId,
    errorsJson: result.review.errors as unknown as Prisma.InputJsonValue,
    score: result.review.score,
    summary: result.review.summary,
    model: result.model,
    promptTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    rawJson: result.review as unknown as Prisma.InputJsonValue,
  };
  await prisma.aIReview.upsert({
    where: { submissionId },
    create: { submissionId, ...data },
    update: data,
  });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.REVIEWED },
  });
}

export type AutoReviewOutcome =
  | { status: "reviewed" }
  | { status: "skipped" }
  | { status: "failed"; error: string };

/**
 * Fire an AI review right after a submission is created. Never throws.
 * `scope` is an extra tenant/participant filter the caller must pass so this
 * can never load a submission outside the caller's scope (defence in depth —
 * both call sites already verify ownership before calling).
 */
export async function runAutoReview(
  submissionId: string,
  scope: Prisma.SubmissionWhereInput = {},
): Promise<AutoReviewOutcome> {
  if (!isAiConfigured()) return { status: "skipped" };

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, ...scope },
    select: {
      id: true,
      teacherId: true,
      text: true,
      fileUrl: true,
      fileType: true,
      assignment: {
        select: {
          title: true,
          description: true,
          metadataJson: true,
          lesson: { select: { subject: true } },
        },
      },
    },
  });
  if (!submission) return { status: "failed", error: "submission not found" };

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.REVIEWING },
  });

  try {
    let file: ReviewInput["file"] = null;
    if (submission.fileUrl && submission.fileType && isR2Configured()) {
      file = {
        base64: await fetchObjectBase64(submission.fileUrl),
        mediaType: submission.fileType,
      };
    }

    const meta = assignmentMetaSchema.parse(
      submission.assignment.metadataJson ?? {},
    );
    const subjectLabel = await resolveSubjectLabel(
      submission.teacherId,
      submission.assignment.lesson?.subject ?? null,
    );

    const result = await callReview({
      context: {
        subjectLabel,
        level: null,
        taskType: meta.type ?? null,
        instructionLanguage: DEFAULT_INSTRUCTION_LANGUAGE,
      },
      assignmentTitle: submission.assignment.title,
      assignmentDescription: submission.assignment.description,
      expectedAnswer: meta.answer ?? null,
      expectedSteps: meta.solutionSteps ?? [],
      submissionText: submission.text,
      file,
    });

    await persistReview(submission.teacherId, submissionId, result);
    return { status: "reviewed" };
  } catch (error) {
    await prisma.submission
      .update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.SUBMITTED },
      })
      .catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-review] submission ${submissionId} failed: ${message}`);
    return { status: "failed", error: message };
  }
}

/** Teacher-initiated re-run for one submission (scoped). */
export async function rereviewSubmission(
  teacherId: string,
  submissionId: string,
): Promise<AutoReviewOutcome> {
  const owned = await prisma.submission.findFirst({
    where: { id: submissionId, teacherId },
    select: { id: true },
  });
  if (!owned) return { status: "failed", error: "submission not found" };
  return runAutoReview(submissionId, { teacherId });
}
