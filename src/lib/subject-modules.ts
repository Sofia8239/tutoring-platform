/**
 * Pure logic for the subject-module extension point (no Prisma/server-only
 * import, so it's directly unit-testable). See `server/modules/` for the
 * registry and the DB-backed glue that resolves a teacher's active modules.
 */

/** The contract a subject module registers with the core — see server/modules/index.ts. */
export type SubjectModule = {
  /** Unique module id, e.g. "language-tools". */
  key: string;
  /** Teacher-facing name, e.g. "Мовний модуль". */
  label: string;
  /**
   * TeacherDiscipline.key values that activate this module (e.g.
   * ["english", "german"]). A teacher's module is active as soon as one of
   * their configured disciplines matches one of these.
   */
  disciplineKeys: string[];
};

/**
 * Which registered modules are active for a teacher, given the discipline
 * keys they've configured (TeacherDiscipline.key, from Part 2). A teacher
 * with no disciplines configured — or one whose disciplines match no module
 * (e.g. every math-only teacher today, since no module exists yet) — gets
 * none, which is the correct, unbroken default.
 */
export function activeModulesForDisciplines(
  modules: SubjectModule[],
  teacherDisciplineKeys: string[],
): SubjectModule[] {
  if (teacherDisciplineKeys.length === 0) return [];
  const keys = new Set(teacherDisciplineKeys);
  return modules.filter((m) => m.disciplineKeys.some((k) => keys.has(k)));
}
