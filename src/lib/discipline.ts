/**
 * Pure logic for the teacher-discipline concept (no Prisma/server-only import,
 * so it's directly unit-testable — see server module conventions).
 */

export const DISCIPLINE_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_DISCIPLINE_LABEL = 60;

/** Ukrainian/Russian Cyrillic -> Latin, so a key derives from any label script. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e",
};

/** Turn a free-text label (any script) into a stable ASCII slug key. */
export function slugifyDisciplineKey(label: string): string {
  const transliterated = label
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[а-яєіїґ]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? "");
  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 40);
}

export type TeacherDisciplineLike = {
  key: string;
  isPrimary: boolean;
};

/** The discipline shown as default — the one marked primary, else the first. */
export function pickPrimaryDiscipline<T extends TeacherDisciplineLike>(
  disciplines: T[],
): T | null {
  return disciplines.find((d) => d.isPrimary) ?? disciplines[0] ?? null;
}

/**
 * Resolve which discipline key governs a lesson: an explicit key on the
 * lesson wins; otherwise it inherits the teacher's primary discipline; if the
 * teacher has configured none, there is no discipline (neutral/general — the
 * pre-existing, math-as-default behaviour keeps working unchanged).
 */
export function resolveLessonDisciplineKey(
  lesson: { disciplineKey: string | null },
  teacherDisciplines: TeacherDisciplineLike[],
): string | null {
  if (lesson.disciplineKey) return lesson.disciplineKey;
  return pickPrimaryDiscipline(teacherDisciplines)?.key ?? null;
}
