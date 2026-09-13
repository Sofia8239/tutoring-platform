import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  AiError,
  AiRefusalError,
  type AiProvider,
  type GenerateStructuredInput,
  type GenerateStructuredResult,
} from "@/server/ai/provider/types";

function isImage(mediaType: string): boolean {
  return (
    mediaType === "image/jpeg" ||
    mediaType === "image/png" ||
    mediaType === "image/webp"
  );
}

export function createClaudeProvider(config: {
  apiKey: string;
  model: string;
}): AiProvider {
  const client = new Anthropic({ apiKey: config.apiKey });

  return {
    name: "claude",
    model: config.model,
    async generateStructured<T>(
      input: GenerateStructuredInput<T>,
    ): Promise<GenerateStructuredResult<T>> {
      const content: Anthropic.ContentBlockParam[] = [];
      for (const file of input.files ?? []) {
        if (isImage(file.mediaType)) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.mediaType as
                "image/jpeg" | "image/png" | "image/webp",
              data: file.base64,
            },
          });
        } else if (file.mediaType === "application/pdf") {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: file.base64,
            },
          });
        }
      }
      content.push({ type: "text", text: input.prompt });

      let message;
      try {
        message = await client.messages.parse({
          model: config.model,
          max_tokens: input.maxTokens ?? 8000,
          thinking: { type: "adaptive" },
          system: input.system,
          messages: [{ role: "user", content }],
          output_config: { format: zodOutputFormat(input.schema) },
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new AiError(`Claude API: ${error.message}`);
        }
        throw error;
      }

      if (message.stop_reason === "refusal") {
        throw new AiRefusalError("Claude відхилив запит.");
      }
      const parsed = input.schema.safeParse(message.parsed_output);
      if (!parsed.success) {
        throw new AiError("Claude повернув неочікуваний формат.");
      }

      return {
        value: parsed.data,
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    },
  };
}
