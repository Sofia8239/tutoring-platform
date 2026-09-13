import { LessonStatus } from "@/generated/prisma/enums";

import type { BadgeTone } from "@/components/ui/badge";

/** Ukrainian labels + badge tones for lesson statuses. Shared server/client. */

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  [LessonStatus.SCHEDULED]: "Заплановано",
  [LessonStatus.COMPLETED]: "Проведено",
  [LessonStatus.CANCELLED]: "Скасовано",
  [LessonStatus.NO_SHOW]: "Не зʼявився",
};

/** indigo = planned · mint = done · rose = cancelled · amber = no-show. */
export const LESSON_STATUS_TONE: Record<LessonStatus, BadgeTone> = {
  [LessonStatus.SCHEDULED]: "primary",
  [LessonStatus.COMPLETED]: "success",
  [LessonStatus.CANCELLED]: "danger",
  [LessonStatus.NO_SHOW]: "attention",
};

export function lessonDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}
