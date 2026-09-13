import { SubmissionStatus } from "@/generated/prisma/enums";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  [SubmissionStatus.PENDING]: "Очікує",
  [SubmissionStatus.SUBMITTED]: "Здано",
  [SubmissionStatus.REVIEWING]: "Перевіряється",
  [SubmissionStatus.REVIEWED]: "Перевірено",
  [SubmissionStatus.LATE]: "Здано із запізненням",
};
