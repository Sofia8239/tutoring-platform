import "server-only";

import { prisma } from "@/lib/prisma";
import { parseIncomingDoc, docOrEmpty } from "@/lib/tiptap-doc";
import { renderPageHtml } from "@/lib/tiptap-render";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Concept pages (TipTap documents). A page belongs to a teacher (`ownerId` +
 * `teacherId`) and may optionally be attached to one of that teacher's lessons.
 * The teacher edits; the lesson's student sees a read-only render. Every query
 * is scoped by owner / participant.
 */

export class PageError extends Error {}

const MAX_TITLE_LENGTH = 200;

export type PageListItem = {
  id: string;
  title: string;
  updatedAt: Date;
  lesson: { id: string; subject: string } | null;
};

export async function listTeacherPages(
  teacherId: string,
): Promise<PageListItem[]> {
  const rows = await prisma.page.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      lesson: { select: { id: true, subject: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt,
    lesson: row.lesson,
  }));
}

export async function listTeacherLessonPages(
  teacherId: string,
  lessonId: string,
): Promise<Pick<PageListItem, "id" | "title" | "updatedAt">[]> {
  return prisma.page.findMany({
    where: { teacherId, lessonId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function listStudentLessonPages(
  studentId: string,
  lessonId: string,
): Promise<Pick<PageListItem, "id" | "title" | "updatedAt">[]> {
  return prisma.page.findMany({
    where: { lessonId, lesson: { studentId } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
}

export type LessonExportPage = {
  id: string;
  title: string;
  updatedAt: Date;
  contentJson: unknown;
};

/**
 * A lesson's pages ready for the combined PDF, oldest first. `pageIds`, when
 * given, restricts to that selection. Every row is scoped by `teacherId` AND
 * `lessonId`, so another teacher's ids passed in `pageIds` return nothing.
 */
export async function getLessonPagesForExport(
  teacherId: string,
  lessonId: string,
  pageIds?: string[],
): Promise<{ lessonSubject: string | null; pages: LessonExportPage[] }> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: { subject: true },
  });
  if (!lesson) return { lessonSubject: null, pages: [] };

  const rows = await prisma.page.findMany({
    where: {
      teacherId,
      lessonId,
      ...(pageIds && pageIds.length > 0 ? { id: { in: pageIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, updatedAt: true, contentJson: true },
  });

  return { lessonSubject: lesson.subject, pages: rows };
}

export type TeacherPage = {
  id: string;
  title: string;
  contentJson: unknown;
  lessonId: string | null;
  updatedAt: Date;
};

export async function getPageForTeacher(
  teacherId: string,
  pageId: string,
): Promise<TeacherPage | null> {
  const row = await prisma.page.findFirst({
    where: { id: pageId, teacherId },
    select: {
      id: true,
      title: true,
      contentJson: true,
      lessonId: true,
      updatedAt: true,
    },
  });
  return row
    ? {
        id: row.id,
        title: row.title,
        contentJson: docOrEmpty(row.contentJson),
        lessonId: row.lessonId,
        updatedAt: row.updatedAt,
      }
    : null;
}

export type StudentPage = {
  id: string;
  title: string;
  html: string;
  lessonSubject: string;
  updatedAt: Date;
};

/** A student may read a page only if it is attached to one of their lessons. */
export async function getPageForStudent(
  studentId: string,
  pageId: string,
): Promise<StudentPage | null> {
  const row = await prisma.page.findFirst({
    where: { id: pageId, lesson: { studentId } },
    select: {
      id: true,
      title: true,
      contentJson: true,
      updatedAt: true,
      lesson: { select: { subject: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    html: renderPageHtml(row.contentJson),
    lessonSubject: row.lesson?.subject ?? "",
    updatedAt: row.updatedAt,
  };
}

async function assertLessonOwned(
  teacherId: string,
  lessonId: string,
): Promise<void> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: { id: true },
  });
  if (!lesson) {
    throw new PageError("Такого уроку немає серед ваших.");
  }
}

export async function createPage(
  teacherId: string,
  input: { title?: string; lessonId?: string | null },
): Promise<{ id: string }> {
  if (input.lessonId) {
    await assertLessonOwned(teacherId, input.lessonId);
  }
  const page = await prisma.page.create({
    data: {
      teacherId,
      ownerId: teacherId,
      lessonId: input.lessonId ?? null,
      title: (input.title?.trim() || "Без назви").slice(0, MAX_TITLE_LENGTH),
    },
    select: { id: true },
  });
  return page;
}

export async function updatePage(
  teacherId: string,
  pageId: string,
  input: {
    title?: string;
    contentJson?: unknown;
    lessonId?: string | null;
  },
): Promise<{ updatedAt: Date }> {
  const existing = await prisma.page.findFirst({
    where: { id: pageId, teacherId },
    select: { id: true },
  });
  if (!existing) {
    throw new PageError("Сторінку не знайдено.");
  }

  const data: Prisma.PageUpdateInput = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new PageError("Назва не може бути порожньою.");
    data.title = title.slice(0, MAX_TITLE_LENGTH);
  }

  if (input.contentJson !== undefined) {
    const parsed = parseIncomingDoc(input.contentJson);
    if (!parsed.ok) throw new PageError(parsed.error);
    data.contentJson = parsed.doc as unknown as Prisma.InputJsonValue;
  }

  if (input.lessonId !== undefined) {
    if (input.lessonId) {
      await assertLessonOwned(teacherId, input.lessonId);
      data.lesson = { connect: { id: input.lessonId } };
    } else {
      data.lesson = { disconnect: true };
    }
  }

  const row = await prisma.page.update({
    where: { id: pageId },
    data,
    select: { updatedAt: true },
  });
  return row;
}

export async function deletePage(
  teacherId: string,
  pageId: string,
): Promise<void> {
  const existing = await prisma.page.findFirst({
    where: { id: pageId, teacherId },
    select: { id: true },
  });
  if (!existing) {
    throw new PageError("Сторінку не знайдено.");
  }
  await prisma.page.delete({ where: { id: pageId } });
}
