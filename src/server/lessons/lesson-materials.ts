import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildLessonMaterialFlags,
  type LessonMaterialFlags,
} from "@/lib/lesson-materials";

/**
 * Whether each lesson has a conspect (Page)/homework (Assignment)/board
 * (Whiteboard) — the small material badges in a lesson list. Scoped by
 * `teacherId` in addition to the caller's own `lessonIds` (golden rule 7),
 * even though callers already scope `lessonIds` themselves.
 */
export async function listLessonMaterialFlags(
  teacherId: string,
  lessonIds: string[],
): Promise<Map<string, LessonMaterialFlags>> {
  if (lessonIds.length === 0) return new Map();

  const [pages, assignments, boards] = await Promise.all([
    prisma.page.findMany({
      where: { teacherId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
      distinct: ["lessonId"],
    }),
    prisma.assignment.findMany({
      where: { teacherId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
      distinct: ["lessonId"],
    }),
    prisma.whiteboard.findMany({
      where: { teacherId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }),
  ]);

  return buildLessonMaterialFlags(lessonIds, {
    pages: pages.map((p) => p.lessonId).filter((id): id is string => !!id),
    assignments: assignments
      .map((a) => a.lessonId)
      .filter((id): id is string => !!id),
    boards: boards.map((b) => b.lessonId),
  });
}
