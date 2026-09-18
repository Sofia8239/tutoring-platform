import { SubmissionStatus } from "@/generated/prisma/enums";

import type { BadgeTone } from "@/components/ui/badge";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  [SubmissionStatus.PENDING]: "Очікує",
  [SubmissionStatus.SUBMITTED]: "Здано",
  [SubmissionStatus.REVIEWING]: "Перевіряється",
  [SubmissionStatus.REVIEWED]: "Перевірено",
  [SubmissionStatus.LATE]: "Здано із запізненням",
};

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  [SubmissionStatus.PENDING]: "attention",
  [SubmissionStatus.SUBMITTED]: "primary",
  [SubmissionStatus.REVIEWING]: "attention",
  [SubmissionStatus.REVIEWED]: "success",
  [SubmissionStatus.LATE]: "danger",
};
