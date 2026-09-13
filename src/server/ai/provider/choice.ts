/**
 * Pure provider-selection logic — no SDK instantiation, no `server-only` — so it
 * unit tests. `getAiProvider()` in `./index.ts` calls this and builds the
 * matching adapter.
 */

export type ProviderName = "gemini" | "claude" | "openai";

export type AiEnv = {
  AI_PROVIDER: ProviderName;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
};

export type ProviderChoice = {
  provider: ProviderName;
  apiKey: string;
  model: string;
} | null;

const KEY: Record<ProviderName, keyof AiEnv> = {
  gemini: "GEMINI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

const MODEL: Record<ProviderName, keyof AiEnv> = {
  gemini: "GEMINI_MODEL",
  claude: "ANTHROPIC_MODEL",
  openai: "OPENAI_MODEL",
};

/** The active provider + its credentials, or `null` when the key is missing. */
export function resolveProviderChoice(env: AiEnv): ProviderChoice {
  const provider = env.AI_PROVIDER;
  const apiKey = env[KEY[provider]] as string | undefined;
  if (!apiKey) return null;
  return { provider, apiKey, model: env[MODEL[provider]] as string };
}
