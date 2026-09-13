import "server-only";

import OpenAI, { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";

import {
  AiError,
  AiRefusalError,
  type AiProvider,
  type GenerateStructuredInput,
  type GenerateStructuredResult,
} from "@/server/ai/provider/types";

export function createOpenAiProvider(config: {
  apiKey: string;
  model: string;
}): AiProvider {
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    name: "openai",
    model: config.model,
    async generateStructured<T>(
      input: GenerateStructuredInput<T>,
    ): Promise<GenerateStructuredResult<T>> {
      const content: ResponseInputContent[] = [];
      for (const file of input.files ?? []) {
        if (file.mediaType === "application/pdf") {
          content.push({
            type: "input_file",
            filename: "submission.pdf",
            file_data: `data:application/pdf;base64,${file.base64}`,
          });
        } else {
          content.push({
            type: "input_image",
            detail: "auto",
            image_url: `data:${file.mediaType};base64,${file.base64}`,
          });
        }
      }
      content.push({ type: "input_text", text: input.prompt });

      let response;
      try {
        response = await client.responses.parse({
          model: config.model,
          instructions: input.system,
          max_output_tokens: input.maxTokens ?? 8000,
          input: [{ role: "user", content }],
          text: { format: zodTextFormat(input.schema, input.schemaName) },
        });
      } catch (error) {
        if (error instanceof APIError) {
          throw new AiError(`OpenAI API: ${error.message}`);
        }
        throw error;
      }

      if (response.status === "incomplete") {
        throw new AiError("OpenAI не завершив відповідь (ліміт токенів?).");
      }
      if (response.output_parsed == null) {
        const refusal = response.output
          .flatMap((item) => (item.type === "message" ? item.content : []))
          .find((c) => c.type === "refusal");
        if (refusal) throw new AiRefusalError("OpenAI відхилив запит.");
        throw new AiError("OpenAI повернув неочікуваний формат.");
      }

      return {
        value: response.output_parsed as T,
        model: response.model,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}
