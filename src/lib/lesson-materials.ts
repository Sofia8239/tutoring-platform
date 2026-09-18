/**
 * Pure logic for the "does this lesson have a conspect/homework/board" badges
 * shown in a lesson list (no Prisma/server-only import, so it's directly
 * unit-testable — see server/lessons/lesson-materials.ts for the DB-backed
 * glue that gathers `present`).
 */

export type LessonMaterialFlags = {
  hasNotes: boolean;
  hasAssignment: boolean;
  hasBoard: boolean;
};

export function buildLessonMaterialFlags(
  lessonIds: string[],
  present: { pages: string[]; assignments: string[]; boards: string[] },
): Map<string, LessonMaterialFlags> {
  const pageSet = new Set(present.pages);
  const assignmentSet = new Set(present.assignments);
  const boardSet = new Set(present.boards);

  const flags = new Map<string, LessonMaterialFlags>();
  for (const id of lessonIds) {
    flags.set(id, {
      hasNotes: pageSet.has(id),
      hasAssignment: assignmentSet.has(id),
      hasBoard: boardSet.has(id),
    });
  }
  return flags;
}
