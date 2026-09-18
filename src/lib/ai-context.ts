/**
 * The subject context AI functions (task generation, homework review) build
 * their prompts from, instead of assuming a fixed subject. Math is just the
 * case where `subjectLabel` happens to be "Математика" — nothing here is
 * math-specific.
 */

export const DEFAULT_INSTRUCTION_LANGUAGE = "українська";

export type DisciplineContext = {
  /** e.g. "Математика", "Англійська мова". `null` = let the AI infer it. */
  subjectLabel: string | null;
  /** e.g. "6 клас", "рівень B1". `null` = unspecified. */
  level: string | null;
  /** e.g. "практичні вправи", "есе". `null` = let the AI pick a fitting type. */
  taskType: string | null;
  instructionLanguage: string;
};

export function defaultDisciplineContext(
  subjectLabel: string | null = null,
): DisciplineContext {
  return {
    subjectLabel,
    level: null,
    taskType: null,
    instructionLanguage: DEFAULT_INSTRUCTION_LANGUAGE,
  };
}

/** Renders the context as a prompt line — the one place this phrasing lives. */
export function describeDisciplineContext(ctx: DisciplineContext): string {
  const subject = ctx.subjectLabel
    ? `Предмет: ${ctx.subjectLabel}.`
    : "Предмет не вказано — визнач його з матеріалу нижче.";
  const level = ctx.level ? ` Рівень/клас: ${ctx.level}.` : "";
  const taskType = ctx.taskType
    ? ` Тип завдань: ${ctx.taskType}.`
    : " Тип завдань обери сам — підходящий для цього предмета й матеріалу.";
  return `${subject}${level}${taskType} Мова відповіді: ${ctx.instructionLanguage}.`;
}
