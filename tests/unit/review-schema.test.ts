import { describe, expect, it } from "vitest";

import { reviewSchema } from "@/server/ai/review-schema";

const review = {
  errors: [
    {
      location: "Крок 2",
      type: "арифметика",
      explanation: "16 − 24 = −8, а не 8.",
      severity: "major" as const,
    },
  ],
  score: 82,
  summary: "Загалом добре, одна арифметична помилка.",
};

describe("reviewSchema", () => {
  it("accepts a well-formed review", () => {
    expect(reviewSchema.safeParse(review).success).toBe(true);
  });

  it("accepts an empty error list and a null score", () => {
    expect(
      reviewSchema.safeParse({
        errors: [],
        score: null,
        summary: "Бездоганно.",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown severity", () => {
    expect(
      reviewSchema.safeParse({
        ...review,
        errors: [{ ...review.errors[0], severity: "tiny" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a score outside 0–100", () => {
    expect(reviewSchema.safeParse({ ...review, score: 150 }).success).toBe(
      false,
    );
    expect(reviewSchema.safeParse({ ...review, score: -1 }).success).toBe(
      false,
    );
  });

  it("requires a summary", () => {
    expect(
      reviewSchema.safeParse({ errors: [], score: null, summary: "" }).success,
    ).toBe(false);
  });
});
