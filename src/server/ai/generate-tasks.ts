import "server-only";

import { describeDisciplineContext, type DisciplineContext } from "@/lib/ai-context";
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
 * Subject-neutral by construction: the prompt is built from the caller's
 * `DisciplineContext`, never from an assumed subject. Math is simply the case
 * where that context's `subjectLabel` is "Математика" — behaviour for it is
 * unchanged from before this was parameterised.
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
  context: DisciplineContext;
  /**
   * A snapshot of the lesson's whiteboard, sent as a vision input — this is
   * how hand-drawn content reaches the model; `sourceText`'s whiteboard
   * portion only ever holds typed text shapes.
   */
  boardImage?: { base64: string; mediaType: string } | null;
};

export type GenerateTasksResult = {
  taskSet: GeneratedTaskSet;
  model: string;
  promptUsed: string;
  usage: { inputTokens: number; outputTokens: number };
};

const SYSTEM_PROMPT = `Ти — досвідчений методист і репетитор. На основі наданого\
 конспекту (та за потреби додаткових вказівок і предметного контексту нижче)\
 згенеруй набір самостійних завдань для учня. Кожне завдання має бути СХОЖЕ за\
 темою, типом і складністю на матеріал конспекту, але з іншими деталями —\
 іншими числами, прикладами, реченнями чи формулюванням, залежно від\
 предмета — не копіюй приклади дослівно.\n\
Для кожного завдання дай: умову, тип, складність, коротку фінальну відповідь,\
 приклад виконання ІНШОГО схожого завдання (з поясненням), докладний\
 покроковий розбір виконання самого завдання та 1–3 підказки для учня.`;

function buildUserPrompt(input: GenerateTasksInput): string {
  const difficultyLine =
    input.difficulty === "mixed"
      ? "Склад складності: суміш легких, середніх і складних."
      : `Усі завдання мають складність: ${DIFFICULTY_LABEL[input.difficulty]}.`;

  const parts = [
    describeDisciplineContext(input.context),
    `Згенеруй рівно ${input.count} завдань.`,
    difficultyLine,
    input.instructions.trim()
      ? `Додаткові вказівки викладача:\n${input.instructions.trim()}`
      : null,
    input.sourceText.trim()
      ? `Матеріал (конспект / дошка):\n"""\n${input.sourceText.trim()}\n"""`
      : null,
    input.boardImage
      ? "Додатково додано зображення дошки уроку (рукописний матеріал) — врахуй його як основний або додатковий матеріал."
      : null,
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
    throw new AiError("Кількість завдань має бути від 1 до 10.");
  }
  const sourceText = input.sourceText.trim();
  if (!sourceText && !input.boardImage) {
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
    files: input.boardImage ? [input.boardImage] : [],
  });

  return { taskSet: value, model, promptUsed, usage };
}
