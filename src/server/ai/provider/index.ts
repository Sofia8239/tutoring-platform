import "server-only";

import { env } from "@/lib/env";

import { resolveProviderChoice } from "@/server/ai/provider/choice";
import { createClaudeProvider } from "@/server/ai/provider/claude";
import { createGeminiProvider } from "@/server/ai/provider/gemini";
import { createOpenAiProvider } from "@/server/ai/provider/openai";
import { createOpenRouterProvider } from "@/server/ai/provider/openrouter";
import type { AiProvider } from "@/server/ai/provider/types";

export {
  AiError,
  AiNotConfiguredError,
  AiRefusalError,
} from "@/server/ai/provider/types";
export type { AiProvider, AiFile, AiUsage } from "@/server/ai/provider/types";
export { resolveProviderChoice } from "@/server/ai/provider/choice";

/**
 * The active AI provider, or `null` when `AI_PROVIDER`'s key is missing.
 * `AI_PROVIDER` env: "gemini" (default) | "claude" | "openai" | "openrouter".
 */
export function getAiProvider(): AiProvider | null {
  const choice = resolveProviderChoice(env);
  if (!choice) return null;

  switch (choice.provider) {
    case "claude":
      return createClaudeProvider(choice);
    case "openai":
      return createOpenAiProvider(choice);
    case "gemini":
      return createGeminiProvider(choice);
    case "openrouter":
      return createOpenRouterProvider({
        ...choice,
        fallbackModels: env.OPENROUTER_FALLBACK_MODELS?.split(",")
          .map((m) => m.trim())
          .filter(Boolean),
      });
  }
}

export function isAiConfigured(): boolean {
  return getAiProvider() !== null;
}
