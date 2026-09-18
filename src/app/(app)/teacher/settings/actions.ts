"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { parseMeetingUrl } from "@/lib/meeting-url";
import { setDefaultMeetingUrl } from "@/server/users/users";
import { disconnectGoogleIntegration } from "@/server/integrations/google/client";
import {
  addTeacherDiscipline,
  DisciplineError,
  removeTeacherDiscipline,
  setPrimaryDiscipline,
} from "@/server/teacher/disciplines";
import { UserRole } from "@/generated/prisma/enums";

export type SettingsState = {
  ok: boolean;
  message: string | null;
  value: string;
};

export async function updateMeetingUrlAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const raw = String(formData.get("defaultMeetingUrl") ?? "");

  const parsed = parseMeetingUrl(raw);
  if (!parsed.ok) {
    return { ok: false, message: parsed.error, value: raw };
  }

  await setDefaultMeetingUrl(teacherId, parsed.url);
  revalidatePath("/teacher/settings");
  revalidatePath("/teacher/lessons/new");

  return {
    ok: true,
    message: parsed.url ? "Збережено." : "Посилання очищено.",
    value: parsed.url ?? "",
  };
}

/** Revoke + forget the teacher's Google Calendar connection. */
export async function disconnectGoogleAction(): Promise<void> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  await disconnectGoogleIntegration(teacherId);
  revalidatePath("/teacher/settings");
}

// ---------------------------------------------------------------------------
// Disciplines (subjects the teacher teaches)
// ---------------------------------------------------------------------------

export type DisciplineActionState = { ok: boolean; message: string | null };

export async function addDisciplineAction(
  _prev: DisciplineActionState,
  formData: FormData,
): Promise<DisciplineActionState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const label = String(formData.get("label") ?? "");

  try {
    await addTeacherDiscipline(teacherId, label);
  } catch (error) {
    if (error instanceof DisciplineError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/teacher/settings");
  revalidatePath("/teacher/lessons/new");
  return { ok: true, message: null };
}

export async function removeDisciplineAction(
  formData: FormData,
): Promise<void> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  if (disciplineId) {
    await removeTeacherDiscipline(teacherId, disciplineId).catch(() => {});
  }
  revalidatePath("/teacher/settings");
  revalidatePath("/teacher/lessons/new");
}

export async function setPrimaryDisciplineAction(
  formData: FormData,
): Promise<void> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const disciplineId = String(formData.get("disciplineId") ?? "");
  if (disciplineId) {
    await setPrimaryDiscipline(teacherId, disciplineId).catch(() => {});
  }
  revalidatePath("/teacher/settings");
  revalidatePath("/teacher/lessons/new");
}
