import { LessonStatus } from "@/generated/prisma/enums";

/**
 * Pure lesson rules — no DB, no `next/*`, no `server-only` — so they unit test
 * directly and can run anywhere (an edge check, a job, the service layer).
 */

/** Shortest / longest a single lesson may be booked for. */
export const MIN_LESSON_MINUTES = 15;
export const MAX_LESSON_MINUTES = 8 * 60;

/**
 * Allowed status moves. A lesson is only ever booked as `SCHEDULED`; from there
 * it lands in exactly one terminal state. Terminal states don't transition
 * again — undoing a mistake is a delete + re-create, which keeps the timeline
 * of `completedAt` / `cancelledAt` honest (golden rule 1).
 */
export const LESSON_STATUS_TRANSITIONS: Readonly<
  Record<LessonStatus, readonly LessonStatus[]>
> = {
  [LessonStatus.SCHEDULED]: [
    LessonStatus.COMPLETED,
    LessonStatus.CANCELLED,
    LessonStatus.NO_SHOW,
  ],
  [LessonStatus.COMPLETED]: [],
  [LessonStatus.CANCELLED]: [],
  [LessonStatus.NO_SHOW]: [],
};

export function canTransitionLesson(
  from: LessonStatus,
  to: LessonStatus,
): boolean {
  return LESSON_STATUS_TRANSITIONS[from].includes(to);
}

/** The timestamp column to stamp when a lesson enters `status` (golden rule 1). */
export function timestampFieldForStatus(
  status: LessonStatus,
): "completedAt" | "cancelledAt" | null {
  if (status === LessonStatus.COMPLETED) return "completedAt";
  if (status === LessonStatus.CANCELLED) return "cancelledAt";
  // NO_SHOW keeps `scheduledStart` as its effective timestamp; no extra column.
  return null;
}

export type LessonWindowIssue = "end-before-start" | "too-short" | "too-long";

/** Validate a start/end pair. Returns `null` when the window is fine. */
export function validateLessonWindow(
  start: Date,
  end: Date,
): LessonWindowIssue | null {
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes <= 0) return "end-before-start";
  if (minutes < MIN_LESSON_MINUTES) return "too-short";
  if (minutes > MAX_LESSON_MINUTES) return "too-long";
  return null;
}

/**
 * Do two half-open intervals `[start, end)` overlap? Lessons that merely touch
 * (one ends exactly when the next begins) do **not** overlap.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
