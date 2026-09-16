"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import {
  setStudentCanEdit,
  WhiteboardError,
} from "@/server/lessons/whiteboard";
import { UserRole } from "@/generated/prisma/enums";

export type ToggleCanEditState = {
  ok: boolean;
  canEdit: boolean;
  message: string | null;
};

/**
 * Flip "student can draw" <-> "student only watches". Teacher-only — this
 * is the one place that can change it; the toggle UI itself is never even
 * rendered for a student (see WhiteboardCanvas).
 */
export async function toggleStudentCanEditAction(
  prev: ToggleCanEditState,
  formData: FormData,
): Promise<ToggleCanEditState> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const lessonId = String(formData.get("lessonId") ?? "");
  const nextCanEdit = formData.get("canEdit") === "true";

  try {
    await setStudentCanEdit(teacherId, lessonId, nextCanEdit);
  } catch (error) {
    if (error instanceof WhiteboardError) {
      return { ok: false, canEdit: prev.canEdit, message: error.message };
    }
    throw error;
  }

  revalidatePath(`/teacher/lessons/${lessonId}/whiteboard`);
  return { ok: true, canEdit: nextCanEdit, message: null };
}
