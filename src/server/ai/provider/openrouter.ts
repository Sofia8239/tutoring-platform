import "server-only";

import OpenAI, { APIError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

import { isRetryableHttpStatus } from "@/lib/retry-backoff";
import {
  AiError,
  AiRefusalError,
  type AiProvider,
  type GenerateStructuredInput,
  type GenerateStructuredResult,
} from "@/server/ai/provider/types";

/**
 * OpenRouter adapter — one API key, many underlying models, via the
 * OpenAI-compatible Chat Completions API (`client.chat.completions.parse` +
 * `zodResponseFormat`; OpenRouter doesn't implement OpenAI's newer Responses
 * API, so this is a distinct code path from `openai.ts`, not a re-export).
 *
 * The real point of OpenRouter here: model-level insurance. `models` tries
 * each configured model in order and returns the first that answers — one
 * model or provider being down (exactly what happened with Gemini today)
 * doesn't take the whole feature down with it.
 *
 * Chat Completions vision only accepts images, not PDFs (the Responses-API
 * `input_file` used by `openai.ts` has no Chat Completions equivalent) — a
 * PDF submission is a clear, distinct error here rather than a silently
 * text-only review.
 */

function isImage(mediaType: string): boolean {
  return (
    mediaType === "image/jpeg" ||
    mediaType === "image/png" ||
    mediaType === "image/webp"
  );
}

export function createOpenRouterProvider(config: {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
}): AiProvider {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const models = [config.model, ...(config.fallbackModels ?? [])];

  return {
    name: "openrouter",
    model: config.model,
    async generateStructured<T>(
      input: GenerateStructuredInput<T>,
    ): Promise<GenerateStructuredResult<T>> {
      const content: ChatCompletionContentPart[] = [];
      for (const file of input.files ?? []) {
        if (!isImage(file.mediaType)) {
          throw new AiError(
            "OpenRouter підтримує лише зображення (не PDF) у цьому запиті — оберіть інший провайдер для файлів PDF.",
          );
        }
        content.push({
          type: "image_url",
          image_url: { url: `data:${file.mediaType};base64,${file.base64}` },
        });
      }
      content.push({ type: "text", text: input.prompt });

      let lastError: unknown;
      for (const model of models) {
        let completion;
        try {
          completion = await client.chat.completions.parse({
            model,
            max_tokens: input.maxTokens ?? 8000,
            messages: [
              { role: "system", content: input.system },
              { role: "user", content },
            ],
            response_format: zodResponseFormat(input.schema, input.schemaName),
          });
        } catch (error) {
          lastError = error;
          if (error instanceof APIError && isRetryableHttpStatus(error.status ?? 0)) {
            continue; // try the next model in the fallback list
          }
          if (error instanceof APIError) {
            throw new AiError(`OpenRouter API: ${error.message}`);
          }
          throw error;
        }

        const choice = completion.choices[0];
        if (choice?.message.refusal) {
          throw new AiRefusalError(choice.message.refusal);
        }
        if (choice?.message.parsed == null) {
          lastError = new AiError("OpenRouter повернув неочікуваний формат.");
          continue;
        }

        return {
          value: choice.message.parsed,
          model: completion.model || model,
          usage: {
            inputTokens: completion.usage?.prompt_tokens ?? 0,
            outputTokens: completion.usage?.completion_tokens ?? 0,
          },
        };
      }

      if (lastError instanceof AiError) throw lastError;
      const message =
        lastError instanceof Error ? lastError.message : String(lastError);
      throw new AiError(
        `OpenRouter: усі моделі (${models.join(", ")}) недоступні. ${message}`,
      );
    },
  };
}
