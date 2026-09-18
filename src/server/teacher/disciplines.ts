import "server-only";

import { prisma } from "@/lib/prisma";
import {
  MAX_DISCIPLINE_LABEL,
  resolveLessonDisciplineKey,
  slugifyDisciplineKey,
} from "@/lib/discipline";

/**
 * The disciplines/subjects a teacher teaches (golden rule 7: every query
 * scoped by `teacherId`, the tenant key). Free-text labels with a derived
 * slug `key` — no enum, so a teacher can add any subject without a schema
 * change; `key` is what a future subject module registers against.
 */

export class DisciplineError extends Error {}

export type TeacherDisciplineDTO = {
  id: string;
  key: string;
  label: string;
  isPrimary: boolean;
};

export async function listTeacherDisciplines(
  teacherId: string,
): Promise<TeacherDisciplineDTO[]> {
  return prisma.teacherDiscipline.findMany({
    where: { teacherId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, key: true, label: true, isPrimary: true },
  });
}

export async function getPrimaryDiscipline(
  teacherId: string,
): Promise<TeacherDisciplineDTO | null> {
  const disciplines = await listTeacherDisciplines(teacherId);
  return disciplines[0] ?? null;
}

/**
 * The discipline label to show on a lesson page: the lesson's own
 * `disciplineKey` resolved to its label, falling back to the teacher's
 * primary discipline (see `resolveLessonDisciplineKey`). `null` when the
 * teacher hasn't configured any discipline — the neutral, unbroken default.
 */
export async function resolveLessonDisciplineLabel(
  teacherId: string,
  lesson: { disciplineKey: string | null },
): Promise<string | null> {
  const disciplines = await listTeacherDisciplines(teacherId);
  const key = resolveLessonDisciplineKey(lesson, disciplines);
  return disciplines.find((d) => d.key === key)?.label ?? null;
}

/**
 * The subject label to put in an AI prompt: an explicit one (usually a
 * lesson's `subject`) wins, otherwise the teacher's primary discipline,
 * otherwise `null` — meaning "let the AI infer it from the material".
 */
export async function resolveSubjectLabel(
  teacherId: string,
  explicitSubject?: string | null,
): Promise<string | null> {
  if (explicitSubject?.trim()) return explicitSubject.trim();
  const primary = await getPrimaryDiscipline(teacherId);
  return primary?.label ?? null;
}

/** Add a discipline. The very first one a teacher adds becomes primary. */
export async function addTeacherDiscipline(
  teacherId: string,
  label: string,
): Promise<TeacherDisciplineDTO> {
  const trimmed = label.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_DISCIPLINE_LABEL) {
    throw new DisciplineError(
      `Назва предмета — від 2 до ${MAX_DISCIPLINE_LABEL} символів.`,
    );
  }
  const key = slugifyDisciplineKey(trimmed);
  if (!key) {
    throw new DisciplineError("Не вдалося розпізнати назву предмета.");
  }

  const existing = await prisma.teacherDiscipline.findUnique({
    where: { teacherId_key: { teacherId, key } },
    select: { id: true },
  });
  if (existing) {
    throw new DisciplineError("Такий предмет уже додано.");
  }

  const count = await prisma.teacherDiscipline.count({ where: { teacherId } });

  return prisma.teacherDiscipline.create({
    data: { teacherId, key, label: trimmed, isPrimary: count === 0 },
    select: { id: true, key: true, label: true, isPrimary: true },
  });
}

/** Remove a discipline. If it was primary, promotes the oldest remaining one. */
export async function removeTeacherDiscipline(
  teacherId: string,
  disciplineId: string,
): Promise<void> {
  const existing = await prisma.teacherDiscipline.findFirst({
    where: { id: disciplineId, teacherId },
    select: { id: true, isPrimary: true },
  });
  if (!existing) throw new DisciplineError("Предмет не знайдено.");

  await prisma.teacherDiscipline.delete({ where: { id: existing.id } });

  if (existing.isPrimary) {
    const next = await prisma.teacherDiscipline.findFirst({
      where: { teacherId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) {
      await prisma.teacherDiscipline.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }
}

/** Mark one discipline as primary (used when a lesson doesn't set its own). */
export async function setPrimaryDiscipline(
  teacherId: string,
  disciplineId: string,
): Promise<void> {
  const existing = await prisma.teacherDiscipline.findFirst({
    where: { id: disciplineId, teacherId },
    select: { id: true },
  });
  if (!existing) throw new DisciplineError("Предмет не знайдено.");

  await prisma.$transaction([
    prisma.teacherDiscipline.updateMany({
      where: { teacherId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.teacherDiscipline.update({
      where: { id: existing.id },
      data: { isPrimary: true },
    }),
  ]);
}
