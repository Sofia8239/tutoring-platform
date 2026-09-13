/**
 * Pure reminder logic — no DB, no queue. Decides which reminder (if any) is due
 * for a lesson or a student's payment balance, and builds the idempotency keys
 * the worker uses to avoid sending the same reminder twice.
 */

export const LESSON_REMINDER_OFFSETS = ["24h", "1h"] as const;
export type LessonReminderOffset = (typeof LESSON_REMINDER_OFFSETS)[number];

const HOUR = 60 * 60 * 1000;

/**
 * The reminder offset that applies to a scheduled lesson right now, or `null`
 * when the lesson is further out than 24h or already started.
 */
export function lessonReminderOffset(
  scheduledStart: Date,
  now: Date = new Date(),
): LessonReminderOffset | null {
  const ms = scheduledStart.getTime() - now.getTime();
  if (ms <= 0) return null;
  if (ms <= HOUR) return "1h";
  if (ms <= 24 * HOUR) return "24h";
  return null;
}

export function lessonReminderKey(
  lessonId: string,
  offset: LessonReminderOffset,
): string {
  return `lesson:${lessonId}:${offset}`;
}

export type PaymentBalance = {
  paidCount: number;
  completedCount: number;
  upcomingCount: number;
};

/**
 * The student has conducted every lesson they paid for and still has one ahead
 * — nudge them to pay for the next block. Fires again only after another lesson
 * is completed (the key includes `completedCount`).
 */
export function needsPaymentReminder(b: PaymentBalance): boolean {
  return (
    b.completedCount > 0 &&
    b.completedCount >= b.paidCount &&
    b.upcomingCount > 0
  );
}

export function paymentReminderKey(
  studentId: string,
  completedCount: number,
): string {
  return `payment-balance:${studentId}:${completedCount}`;
}
