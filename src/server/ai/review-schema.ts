import { z } from "zod";

/**
 * Structured AI homework review (golden rule 5). `errors` is an array of located
 * mistakes; `score` is 0–100 or null when it cannot be graded.
 */

export const REVIEW_SEVERITIES = ["minor", "major", "critical"] as const;

export const reviewErrorSchema = z.object({
  location: z.string().min(1).max(500),
  type: z.string().min(1).max(200),
  explanation: z.string().min(1).max(3000),
  severity: z.enum(REVIEW_SEVERITIES),
});

export const reviewSchema = z.object({
  errors: z.array(reviewErrorSchema).max(50),
  score: z.number().int().min(0).max(100).nullable(),
  summary: z.string().min(1).max(4000),
});

export type SubmissionReview = z.infer<typeof reviewSchema>;
