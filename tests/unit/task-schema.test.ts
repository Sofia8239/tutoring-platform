import { describe, expect, it } from "vitest";

import {
  generatedProblemSchema,
  generatedTaskSetSchema,
} from "@/server/ai/task-schema";

const problem = {
  prompt: "Розв'яжіть 2x² − 3x + 1 = 0.",
  type: "квадратне рівняння",
  difficulty: "medium" as const,
  answer: "x = 1 або x = 0.5",
  example: "Для x² − 5x + 6 = 0: D = 1, корені 2 і 3.",
  solutionSteps: ["D = 9 − 8 = 1", "x = (3 ± 1) / 4"],
  hints: ["Спочатку знайдіть дискримінант"],
};

describe("generatedProblemSchema", () => {
  it("accepts a well-formed problem", () => {
    expect(generatedProblemSchema.safeParse(problem).success).toBe(true);
  });

  it("rejects an unknown difficulty", () => {
    expect(
      generatedProblemSchema.safeParse({ ...problem, difficulty: "trivial" })
        .success,
    ).toBe(false);
  });

  it("requires at least one solution step", () => {
    expect(
      generatedProblemSchema.safeParse({ ...problem, solutionSteps: [] })
        .success,
    ).toBe(false);
  });

  it("allows an empty hints array", () => {
    expect(
      generatedProblemSchema.safeParse({ ...problem, hints: [] }).success,
    ).toBe(true);
  });
});

describe("generatedTaskSetSchema", () => {
  it("accepts 1–10 problems", () => {
    expect(
      generatedTaskSetSchema.safeParse({ problems: [problem] }).success,
    ).toBe(true);
  });

  it("rejects an empty set", () => {
    expect(generatedTaskSetSchema.safeParse({ problems: [] }).success).toBe(
      false,
    );
  });

  it("rejects more than 10 problems", () => {
    expect(
      generatedTaskSetSchema.safeParse({
        problems: Array.from({ length: 11 }, () => problem),
      }).success,
    ).toBe(false);
  });
});
