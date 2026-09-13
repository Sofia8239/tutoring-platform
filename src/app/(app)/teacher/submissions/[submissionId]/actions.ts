"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { rereviewSubmission } from "@/server/ai/review-submission";
import { UserRole } from "@/generated/prisma/enums";

export type RereviewState = { ok: boolean; message: string | null };

export async function rereviewSubmissionAction(
  _prev: RereviewState,
  formData: FormData,
): Promise<RereviewState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) {
    return { ok: false, message: "Здачу не знайдено." };
  }

  const outcome = await rereviewSubmission(teacherId, submissionId);
  revalidatePath(`/teacher/submissions/${submissionId}`);

  if (outcome.status === "reviewed") {
    return { ok: true, message: "Перевірку оновлено." };
  }
  if (outcome.status === "skipped") {
    return { ok: false, message: "AI-перевірку не налаштовано." };
  }
  return { ok: false, message: `Не вдалося перевірити: ${outcome.error}` };
}
