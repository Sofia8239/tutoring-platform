import "server-only";

import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { extractJsonText } from "@/lib/json-extract";
import {
  backoffDelayMs,
  isDailyQuotaExhausted,
  isRetryableHttpStatus,
} from "@/lib/retry-backoff";
import {
  AiError,
  type AiProvider,
  type GenerateStructuredInput,
  type GenerateStructuredResult,
} from "@/server/ai/provider/types";

/**
 * Gemini adapter. Structured output via `responseMimeType: "application/json"`
 * (Gemini's JSON mode) plus the JSON schema embedded in the prompt (more
 * robust across schema dialects than Gemini's own `responseSchema`, which
 * rejects some shapes `z.toJSONSchema` produces), then Zod-validated.
 *
 * JSON mode constrains syntax, not content — Gemini still occasionally wraps
 * the JSON in a ```json fence or adds a stray sentence around it, especially
 * under `maxOutputTokens` pressure. `extractJsonText` recovers that, and one
 * retry (with a stricter reminder) covers the rest before giving up.
 *
 * Gemini's "thinking" tokens are drawn from the SAME `maxOutputTokens` budget
 * as the visible response by default, so a request with a rich schema (e.g.
 * several generated tasks, each with steps/hints) can silently run out of
 * budget mid-JSON with no error — just a `finishReason: MAX_TOKENS` and a
 * truncated body. We bound the thinking budget so it can't eat the whole
 * allowance, and on a detected truncation the retry doubles the budget
 * instead of repeating the exact same failure.
 *
 * The same attempt loop also absorbs transient API failures (429 rate limit,
 * 503 "high demand" — Gemini returns these fairly often at peak load) with a
 * short backoff before retrying, instead of failing the whole request.
 */

const MAX_ATTEMPTS = 4;
const RETRY_BACKOFF_CAP_MS = 6000;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;
const MAX_OUTPUT_TOKENS_CEILING = 32_000;
const THINKING_BUDGET = 2048;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPromptText(
  input: GenerateStructuredInput<unknown>,
  jsonSchema: string,
  strict: boolean,
): string {
  const instruction = strict
    ? `Поверни ЛИШЕ валідний JSON за цією JSON Schema — без пояснень, без markdown, без \`\`\`. Перший символ відповіді має бути { або [, останній — } або ] відповідно:\n${jsonSchema}`
    : `Поверни ЛИШЕ валідний JSON за цією JSON Schema (без пояснень, без markdown):\n${jsonSchema}`;
  return `${input.prompt}\n\n${instruction}`;
}

export function createGeminiProvider(config: {
  apiKey: string;
  model: string;
}): AiProvider {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    name: "gemini",
    model: config.model,
    async generateStructured<T>(
      input: GenerateStructuredInput<T>,
    ): Promise<GenerateStructuredResult<T>> {
      const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema));
      const fileParts = (input.files ?? []).map((file) => ({
        inlineData: { mimeType: file.mediaType, data: file.base64 },
      }));

      let lastRawText = "";
      let lastFailure = "";
      let maxOutputTokens = input.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const strict = attempt > 1;
        const parts = [
          ...fileParts,
          { text: buildPromptText(input, jsonSchema, strict) },
        ];

        let response;
        try {
          response = await ai.models.generateContent({
            model: config.model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction: input.system,
              responseMimeType: "application/json",
              maxOutputTokens,
              thinkingConfig: { thinkingBudget: THINKING_BUDGET },
            },
          });
        } catch (error) {
          if (
            error instanceof ApiError &&
            isDailyQuotaExhausted(error.status, error.message)
          ) {
            console.error(`[gemini] daily free-tier quota exhausted: ${error.message}`);
            throw new AiError(
              "Вичерпано денний безкоштовний ліміт Gemini для цієї моделі. Спробуйте завтра, або підключіть платний тариф чи інший AI-провайдер у налаштуваннях.",
            );
          }
          const retryable =
            error instanceof ApiError && isRetryableHttpStatus(error.status);
          if (retryable && attempt < MAX_ATTEMPTS) {
            lastFailure = `api-error-${error.status}`;
            await sleep(backoffDelayMs(attempt, RETRY_BACKOFF_CAP_MS));
            continue;
          }
          if (retryable) {
            console.error(
              `[gemini] generateStructured: still failing after ${MAX_ATTEMPTS} attempts (HTTP ${(error as ApiError).status}): ${error.message}`,
            );
            throw new AiError(
              "Gemini тимчасово перевантажений — спробуйте ще раз за хвилину.",
            );
          }
          const message =
            error instanceof Error ? error.message : String(error);
          throw new AiError(`Gemini API: ${message}`);
        }

        const text = response.text ?? "";
        lastRawText = text;
        const truncated =
          response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS;

        let json: unknown;
        try {
          json = JSON.parse(extractJsonText(text));
        } catch {
          lastFailure = truncated ? "truncated" : "invalid-json";
          if (truncated) {
            maxOutputTokens = Math.min(
              maxOutputTokens * 2,
              MAX_OUTPUT_TOKENS_CEILING,
            );
          }
          continue;
        }
        const parsed = input.schema.safeParse(json);
        if (!parsed.success) {
          lastFailure = "schema-mismatch";
          continue;
        }

        const usage = response.usageMetadata;
        return {
          value: parsed.data,
          model: config.model,
          usage: {
            inputTokens: usage?.promptTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
          },
        };
      }

      console.error(
        `[gemini] generateStructured failed after ${MAX_ATTEMPTS} attempt(s) (${lastFailure}), schema "${input.schemaName}". Raw response:\n${lastRawText}`,
      );
      if (lastFailure === "schema-mismatch") {
        throw new AiError("Gemini повернув неочікуваний формат.");
      }
      if (lastFailure === "truncated") {
        throw new AiError(
          "Відповідь Gemini обірвалась — забагато завдань за раз. Спробуйте зменшити кількість або скоротити вказівки.",
        );
      }
      throw new AiError("Gemini повернув невалідний JSON.");
    },
  };
}
