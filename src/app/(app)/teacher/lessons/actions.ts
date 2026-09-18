"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { zonedWallTimeToUtc } from "@/lib/datetime";
import { toMinorUnits } from "@/lib/money";
import { parseMeetingUrl } from "@/lib/meeting-url";
import { getUserTimezone } from "@/server/users/users";
import {
  changeLessonStatus,
  createLesson,
  deleteLesson,
  LessonValidationError,
  updateLesson,
  updateLessonSummary,
  type LessonInput,
} from "@/server/lessons/lessons";
import {
  removeLessonFromGoogle,
  syncLessonToGoogle,
} from "@/server/lessons/calendar-sync";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Create / update — shared form
// ---------------------------------------------------------------------------

export type LessonFormValues = {
  studentId: string;
  subject: string;
  disciplineKey: string;
  start: string;
  durationMinutes: string;
  price: string;
  notes: string;
  meetLink: string;
};

export type LessonFormState = {
  ok: boolean;
  message: string | null;
  values: LessonFormValues;
};

const WALL_CLOCK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const lessonFormSchema = z.object({
  studentId: z.string().min(1, "Оберіть учня."),
  subject: z
    .string()
    .trim()
    .min(2, "Вкажіть тему уроку.")
    .max(200, "Тема задовга."),
  disciplineKey: z.string().trim().max(40).optional().default(""),
  start: z.string().regex(WALL_CLOCK_RE, "Вкажіть дату й час початку."),
  durationMinutes: z.coerce
    .number()
    .int()
    .positive()
    .max(480, "Урок не може бути довшим за 8 годин."),
  price: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(2000, "Нотатка задовга.").optional().default(""),
  meetLink: z.string().trim().max(2048).optional().default(""),
});

function readFormValues(formData: FormData): LessonFormValues {
  return {
    studentId: String(formData.get("studentId") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    disciplineKey: String(formData.get("disciplineKey") ?? ""),
    start: String(formData.get("start") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? "60"),
    price: String(formData.get("price") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    meetLink: String(formData.get("meetLink") ?? ""),
  };
}

/** Turn validated form fields into a service `LessonInput` (UTC + minor units). */
async function toLessonInput(
  values: z.infer<typeof lessonFormSchema>,
  timezone: string,
): Promise<LessonInput> {
  const scheduledStart = zonedWallTimeToUtc(values.start, timezone);
  const scheduledEnd = new Date(
    scheduledStart.getTime() + values.durationMinutes * 60_000,
  );

  let price = 0;
  if (values.price) {
    try {
      price = toMinorUnits(values.price);
    } catch {
      throw new LessonValidationError(
        "Некоректна ціна. Приклад: 300 або 300.50",
      );
    }
  }

  const meetLink = parseMeetingUrl(values.meetLink);
  if (!meetLink.ok) {
    throw new LessonValidationError(meetLink.error);
  }

  return {
    studentId: values.studentId,
    subject: values.subject,
    disciplineKey: values.disciplineKey || null,
    scheduledStart,
    scheduledEnd,
    price,
    notes: values.notes || null,
    meetLink: meetLink.url,
  };
}

export async function createLessonAction(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const raw = readFormValues(formData);

  const parsed = lessonFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Некоректні дані.",
      values: raw,
    };
  }

  let lessonId: string;
  try {
    const timezone = await getUserTimezone(user.id);
    const input = await toLessonInput(parsed.data, timezone);
    const lesson = await createLesson(teacherId, input, timezone);
    lessonId = lesson.id;
    // Best effort: never blocks the lesson, records FAILED on error.
    await syncLessonToGoogle(teacherId, lessonId, timezone);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      return { ok: false, message: error.message, values: raw };
    }
    throw error;
  }

  revalidatePath("/teacher/lessons");
  redirect(`/teacher/lessons/${lessonId}`);
}

export async function updateLessonAction(
  _prev: LessonFormState,
  formData: FormData,
): Promise<LessonFormState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");
  const raw = readFormValues(formData);

  if (!lessonId) {
    return { ok: false, message: "Урок не знайдено.", values: raw };
  }

  const parsed = lessonFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Некоректні дані.",
      values: raw,
    };
  }

  try {
    const timezone = await getUserTimezone(user.id);
    const input = await toLessonInput(parsed.data, timezone);
    await updateLesson(teacherId, lessonId, input, timezone);
    await syncLessonToGoogle(teacherId, lessonId, timezone);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      return { ok: false, message: error.message, values: raw };
    }
    throw error;
  }

  revalidatePath("/teacher/lessons");
  revalidatePath(`/teacher/lessons/${lessonId}`);
  redirect(`/teacher/lessons/${lessonId}`);
}

// ---------------------------------------------------------------------------
// Status change / delete
// ---------------------------------------------------------------------------

export type LessonMutationState = { ok: boolean; message: string | null };

const statusSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum([
    LessonStatus.COMPLETED,
    LessonStatus.CANCELLED,
    LessonStatus.NO_SHOW,
  ] as const),
  cancellationReason: z.string().trim().max(500).optional().default(""),
});

export async function changeLessonStatusAction(
  _prev: LessonMutationState,
  formData: FormData,
): Promise<LessonMutationState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const parsed = statusSchema.safeParse({
    lessonId: formData.get("lessonId"),
    status: formData.get("status"),
    cancellationReason: formData.get("cancellationReason"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Некоректний запит." };
  }

  try {
    await changeLessonStatus({
      teacherId,
      actorId: user.id,
      lessonId: parsed.data.lessonId,
      status: parsed.data.status,
      cancellationReason: parsed.data.cancellationReason || null,
    });
    const timezone = await getUserTimezone(user.id);
    await syncLessonToGoogle(teacherId, parsed.data.lessonId, timezone);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/teacher/lessons");
  revalidatePath(`/teacher/lessons/${parsed.data.lessonId}`);
  return { ok: true, message: null };
}

export async function deleteLessonAction(
  _prev: LessonMutationState,
  formData: FormData,
): Promise<LessonMutationState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");

  if (!lessonId) {
    return { ok: false, message: "Урок не знайдено." };
  }

  try {
    const calendarRef = await deleteLesson(teacherId, lessonId);
    await removeLessonFromGoogle(teacherId, calendarRef);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/teacher/lessons");
  redirect("/teacher/lessons");
}

export async function retryLessonSyncAction(
  _prev: LessonMutationState,
  formData: FormData,
): Promise<LessonMutationState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) {
    return { ok: false, message: "Урок не знайдено." };
  }

  const timezone = await getUserTimezone(user.id);
  const outcome = await syncLessonToGoogle(teacherId, lessonId, timezone);
  revalidatePath(`/teacher/lessons/${lessonId}`);

  if (outcome.status === "failed") {
    return { ok: false, message: `Синхронізація не вдалася: ${outcome.error}` };
  }
  if (outcome.status === "skipped") {
    return { ok: false, message: "Google Календар не підключено." };
  }
  return { ok: true, message: "Синхронізовано з Google Календарем." };
}

// ---------------------------------------------------------------------------
// Lesson summary ("what happened") — independent of the full edit form
// ---------------------------------------------------------------------------

export type SummaryActionState = {
  ok: boolean;
  message: string | null;
  value: string;
};

export async function updateLessonSummaryAction(
  _prev: SummaryActionState,
  formData: FormData,
): Promise<SummaryActionState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");
  const summary = String(formData.get("summary") ?? "");

  if (!lessonId) {
    return { ok: false, message: "Урок не знайдено.", value: summary };
  }

  try {
    await updateLessonSummary(teacherId, lessonId, summary);
  } catch (error) {
    if (error instanceof LessonValidationError) {
      return { ok: false, message: error.message, value: summary };
    }
    throw error;
  }

  revalidatePath(`/teacher/lessons/${lessonId}`);
  revalidatePath(`/student/lessons/${lessonId}`);
  return { ok: true, message: "Збережено.", value: summary.trim() };
}
