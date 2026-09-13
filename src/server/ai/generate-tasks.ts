import "server-only";

import { AiError, getAiProvider } from "@/server/ai/provider";
import {
  DIFFICULTY_LABEL,
  generatedTaskSetSchema,
  type GeneratedTaskSet,
} from "@/server/ai/task-schema";

/**
 * AI task generation. Provider-neutral: goes through `getAiProvider()` (Gemini /
 * Claude / OpenAI, chosen by `AI_PROVIDER`). Structured output is enforced with
 * the Zod schema and re-validated inside the adapter.
 *
 * Callers must check `isAiConfigured()` and hide the entry points when false.
 */

export { AiError, isAiConfigured } from "@/server/ai/provider";

/** Combined source text longer than this is rejected rather than truncated. */
export const MAX_SOURCE_CHARS = 24_000;

export type GenerateTasksInput = {
  sourceText: string;
  instructions: string;
  count: number;
  difficulty: "mixed" | "easy" | "medium" | "hard";
};

export type GenerateTasksResult = {
  taskSet: GeneratedTaskSet;
  model: string;
  promptUsed: string;
  usage: { inputTokens: number; outputTokens: number };
};

const SYSTEM_PROMPT = `Ти — досвідчений методист і репетитор. На основі наданого\
 конспекту (та за потреби додаткових вказівок) згенеруй набір самостійних задач\
 для учня. Кожна задача має бути СХОЖА за темою, типом і складністю на матеріал\
 конспекту, але з іншими числами / формулюванням — не копіюй приклади дослівно.\n\
Мова всіх текстів — українська. Для кожної задачі дай: умову, тип, складність,\
 коротку фінальну відповідь, приклад ІНШОЇ схожої розв'язаної задачі (з\
 розв'язанням), покрокове розв'язання самої задачі та 1–3 підказки для учня.`;

function buildUserPrompt(input: GenerateTasksInput): string {
  const difficultyLine =
    input.difficulty === "mixed"
      ? "Склад складності: суміш легких, середніх і складних."
      : `Усі задачі мають складність: ${DIFFICULTY_LABEL[input.difficulty]}.`;

  const parts = [
    `Згенеруй рівно ${input.count} задач(і).`,
    difficultyLine,
    input.instructions.trim()
      ? `Додаткові вказівки викладача:\n${input.instructions.trim()}`
      : null,
    `Матеріал (конспект / дошка):\n"""\n${input.sourceText.trim()}\n"""`,
  ].filter((part): part is string => Boolean(part));

  return parts.join("\n\n");
}

export async function generateTasks(
  input: GenerateTasksInput,
): Promise<GenerateTasksResult> {
  const provider = getAiProvider();
  if (!provider) {
    throw new AiError("AI-генерацію не налаштовано на сервері.");
  }
  if (input.count < 1 || input.count > 10) {
    throw new AiError("Кількість задач має бути від 1 до 10.");
  }
  const sourceText = input.sourceText.trim();
  if (!sourceText) {
    throw new AiError("Немає матеріалу для генерації.");
  }
  if (sourceText.length > MAX_SOURCE_CHARS) {
    throw new AiError(
      `Матеріал завеликий (${sourceText.length} символів, максимум ${MAX_SOURCE_CHARS}). Скоротіть конспект.`,
    );
  }

  const promptUsed = buildUserPrompt({ ...input, sourceText });

  const { value, model, usage } = await provider.generateStructured({
    schema: generatedTaskSetSchema,
    schemaName: "task_set",
    system: SYSTEM_PROMPT,
    prompt: promptUsed,
  });

  return { taskSet: value, model, promptUsed, usage };
}
