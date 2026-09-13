import { z } from "zod";

/**
 * The shape the model must return (golden rule 5: structured JSON, Zod-validated,
 * never free-text parsing). `example` is a *similar solved* problem; the full
 * answer / steps / hints are teacher-only and live in `Assignment.metadataJson`.
 */

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const generatedProblemSchema = z.object({
  prompt: z.string().min(1).max(4000),
  type: z.string().min(1).max(120),
  difficulty: z.enum(DIFFICULTIES),
  answer: z.string().min(1).max(4000),
  example: z.string().min(1).max(6000),
  solutionSteps: z.array(z.string().min(1).max(2000)).min(1).max(30),
  hints: z.array(z.string().min(1).max(1000)).max(10),
});

export const generatedTaskSetSchema = z.object({
  problems: z.array(generatedProblemSchema).min(1).max(10),
});

export type GeneratedProblem = z.infer<typeof generatedProblemSchema>;
export type GeneratedTaskSet = z.infer<typeof generatedTaskSetSchema>;

export const DIFFICULTY_LABEL: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "легка",
  medium: "середня",
  hard: "складна",
};
