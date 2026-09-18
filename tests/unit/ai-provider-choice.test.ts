import { describe, expect, it } from "vitest";

import { resolveProviderChoice, type AiEnv } from "@/server/ai/provider/choice";

const base: AiEnv = {
  AI_PROVIDER: "gemini",
  ANTHROPIC_MODEL: "claude-opus-5",
  GEMINI_MODEL: "gemini-2.5-flash",
  OPENAI_MODEL: "gpt-4o-mini",
  OPENROUTER_MODEL: "openai/gpt-4o-mini",
};

describe("resolveProviderChoice", () => {
  it("returns null when the selected provider has no key", () => {
    expect(resolveProviderChoice(base)).toBeNull();
    expect(
      resolveProviderChoice({ ...base, AI_PROVIDER: "claude" }),
    ).toBeNull();
  });

  it("picks the selected provider's key + model", () => {
    expect(resolveProviderChoice({ ...base, GEMINI_API_KEY: "g" })).toEqual({
      provider: "gemini",
      apiKey: "g",
      model: "gemini-2.5-flash",
    });
    expect(
      resolveProviderChoice({
        ...base,
        AI_PROVIDER: "claude",
        ANTHROPIC_API_KEY: "a",
      }),
    ).toEqual({ provider: "claude", apiKey: "a", model: "claude-opus-5" });
    expect(
      resolveProviderChoice({
        ...base,
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "o",
      }),
    ).toEqual({ provider: "openai", apiKey: "o", model: "gpt-4o-mini" });
    expect(
      resolveProviderChoice({
        ...base,
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "r",
      }),
    ).toEqual({
      provider: "openrouter",
      apiKey: "r",
      model: "openai/gpt-4o-mini",
    });
  });

  it("does not fall back to another provider's key", () => {
    expect(
      resolveProviderChoice({
        ...base,
        AI_PROVIDER: "claude",
        GEMINI_API_KEY: "g",
      }),
    ).toBeNull();
  });
});
