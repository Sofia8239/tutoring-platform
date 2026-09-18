import { describe, expect, it } from "vitest";

import {
  defaultDisciplineContext,
  describeDisciplineContext,
  type DisciplineContext,
} from "@/lib/ai-context";

describe("describeDisciplineContext", () => {
  it("names the subject when known — math case, unchanged in spirit", () => {
    const line = describeDisciplineContext(
      defaultDisciplineContext("Математика"),
    );
    expect(line).toContain("Предмет: Математика.");
    expect(line).toContain("Мова відповіді: українська.");
  });

  it("asks the AI to infer the subject when unknown, instead of assuming one", () => {
    const line = describeDisciplineContext(defaultDisciplineContext(null));
    expect(line).toContain("Предмет не вказано");
    expect(line.toLowerCase()).not.toContain("математик");
  });

  it("includes level and task type only when provided", () => {
    const withBoth: DisciplineContext = {
      subjectLabel: "Англійська мова",
      level: "рівень B1",
      taskType: "граматичні вправи",
      instructionLanguage: "українська",
    };
    const line = describeDisciplineContext(withBoth);
    expect(line).toContain("Рівень/клас: рівень B1.");
    expect(line).toContain("Тип завдань: граматичні вправи.");
  });

  it("lets the AI pick a fitting task type when unset, for any subject", () => {
    const line = describeDisciplineContext(
      defaultDisciplineContext("Історія"),
    );
    expect(line).toContain("Тип завдань обери сам");
  });

  it("is a different, subject-appropriate result for different disciplines with the same code path", () => {
    const math = describeDisciplineContext(defaultDisciplineContext("Математика"));
    const language = describeDisciplineContext(
      defaultDisciplineContext("Англійська мова"),
    );
    expect(math).not.toBe(language);
    expect(math).toContain("Математика");
    expect(language).toContain("Англійська мова");
  });
});
