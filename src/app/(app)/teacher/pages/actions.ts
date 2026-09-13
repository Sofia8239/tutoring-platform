"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import {
  createPage,
  deletePage,
  PageError,
  updatePage,
} from "@/server/pages/pages";
import { UserRole } from "@/generated/prisma/enums";

export type SavePageResult =
  { ok: true; savedAt: string } | { ok: false; error: string };

export async function createPageAction(formData: FormData): Promise<void> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const lessonId = String(formData.get("lessonId") ?? "") || null;
  const title = String(formData.get("title") ?? "") || undefined;

  const { id } = await createPage(teacherId, { title, lessonId });

  revalidatePath("/teacher/pages");
  if (lessonId) revalidatePath(`/teacher/lessons/${lessonId}`);
  redirect(`/teacher/pages/${id}`);
}

/**
 * Patch a page. Called from the editor for any of: title (on blur), content
 * (debounced), lesson link (on change). Not a form action — plain arg.
 */
export async function updatePageAction(input: {
  pageId: string;
  title?: string;
  contentJson?: unknown;
  lessonId?: string | null;
}): Promise<SavePageResult> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  if (!input?.pageId) {
    return { ok: false, error: "Сторінку не знайдено." };
  }

  try {
    const { updatedAt } = await updatePage(teacherId, input.pageId, {
      title: input.title,
      contentJson: input.contentJson,
      lessonId: input.lessonId,
    });
    revalidatePath(`/teacher/pages/${input.pageId}`);
    revalidatePath("/teacher/pages");
    return { ok: true, savedAt: updatedAt.toISOString() };
  } catch (error) {
    if (error instanceof PageError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const pageId = String(formData.get("pageId") ?? "");

  if (pageId) {
    try {
      await deletePage(teacherId, pageId);
    } catch (error) {
      if (!(error instanceof PageError)) throw error;
    }
  }

  revalidatePath("/teacher/pages");
  redirect("/teacher/pages");
}
