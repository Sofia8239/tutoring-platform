import type { z } from "zod";

/**
 * Provider-neutral AI contract. Business logic (task generation, homework
 * review) depends only on this — swapping Gemini / Claude / OpenAI is an env
 * change, not a code change.
 */

export class AiError extends Error {}
export class AiNotConfiguredError extends AiError {}
export class AiRefusalError extends AiError {}

export type AiUsage = { inputTokens: number; outputTokens: number };

/** A base64-encoded image or PDF for vision requests. */
export type AiFile = {
  base64: string;
  /** "image/jpeg" | "image/png" | "image/webp" | "application/pdf" */
  mediaType: string;
};

export type GenerateStructuredInput<T> = {
  schema: z.ZodType<T>;
  /** A stable name for the schema (some providers require one). */
  schemaName: string;
  system: string;
  prompt: string;
  files?: AiFile[];
  maxTokens?: number;
};

export type GenerateStructuredResult<T> = {
  value: T;
  model: string;
  usage: AiUsage;
};

export interface AiProvider {
  readonly name: "gemini" | "claude" | "openai" | "openrouter";
  readonly model: string;
  generateStructured<T>(
    input: GenerateStructuredInput<T>,
  ): Promise<GenerateStructuredResult<T>>;
}
