import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  AiError,
  type AiProvider,
  type GenerateStructuredInput,
  type GenerateStructuredResult,
} from "@/server/ai/provider/types";

/**
 * Gemini adapter. Structured output via `responseMimeType: "application/json"`
 * plus the JSON schema embedded in the prompt (more robust across schema
 * dialects than Gemini's own `responseSchema`), then Zod-validated.
 */
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
      const parts: {
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }[] = [];
      for (const file of input.files ?? []) {
        parts.push({
          inlineData: { mimeType: file.mediaType, data: file.base64 },
        });
      }
      parts.push({
        text: `${input.prompt}\n\nПоверни ЛИШЕ валідний JSON за цією JSON Schema (без пояснень, без markdown):\n${jsonSchema}`,
      });

      let response;
      try {
        response = await ai.models.generateContent({
          model: config.model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: input.system,
            responseMimeType: "application/json",
            maxOutputTokens: input.maxTokens ?? 8000,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new AiError(`Gemini API: ${message}`);
      }

      const text = response.text ?? "";
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AiError("Gemini повернув невалідний JSON.");
      }
      const parsed = input.schema.safeParse(json);
      if (!parsed.success) {
        throw new AiError("Gemini повернув неочікуваний формат.");
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
    },
  };
}
