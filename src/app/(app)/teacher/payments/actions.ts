"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { toMinorUnits } from "@/lib/money";
import {
  createLessonPaymentRequest,
  createManualPaymentRequest,
  PaymentRequestError,
} from "@/server/payments/payments";
import { UserRole } from "@/generated/prisma/enums";

export type RequestPaymentState = { ok: boolean; message: string | null };

/** Used both from a lesson's detail page and (if ever needed) elsewhere. */
export async function requestLessonPaymentAction(
  _prev: RequestPaymentState,
  formData: FormData,
): Promise<RequestPaymentState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");

  try {
    await createLessonPaymentRequest(teacherId, lessonId);
  } catch (error) {
    if (error instanceof PaymentRequestError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath(`/teacher/lessons/${lessonId}`);
  revalidatePath("/teacher/payments");
  return { ok: true, message: "Запит на оплату створено." };
}

const manualSchema = z.object({
  studentId: z.string().min(1, "Оберіть учня."),
  amount: z.string().min(1, "Вкажіть суму."),
  description: z.string().trim().max(300).optional(),
});

export async function requestManualPaymentAction(
  _prev: RequestPaymentState,
  formData: FormData,
): Promise<RequestPaymentState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const parsed = manualSchema.safeParse({
    studentId: formData.get("studentId"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Некоректні дані.",
    };
  }

  let amount: number;
  try {
    amount = toMinorUnits(parsed.data.amount);
  } catch {
    return { ok: false, message: "Некоректна сума." };
  }
  if (amount <= 0) {
    return { ok: false, message: "Сума має бути більшою за нуль." };
  }

  try {
    await createManualPaymentRequest(teacherId, {
      studentId: parsed.data.studentId,
      amount,
      description: parsed.data.description,
    });
  } catch (error) {
    if (error instanceof PaymentRequestError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/teacher/payments");
  return { ok: true, message: "Запит на оплату створено." };
}
