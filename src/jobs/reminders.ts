import { scanLessonReminders } from "@/server/notifications/lesson-reminders";
import { scanPaymentReminders } from "@/server/notifications/payment-reminders";
import { recomputeDailyStatsForAllTeachers } from "@/server/stats/daily-stats";
import type { ReminderJobName } from "@/jobs/queue";

/** Dispatch a reminder/stats job by name. Shared by the worker and the one-shot CLI. */
export async function runReminderJob(
  name: ReminderJobName,
): Promise<{ scanned: number; sent: number } | { teachers: number }> {
  switch (name) {
    case "scan-lessons":
      return scanLessonReminders();
    case "scan-payments":
      return scanPaymentReminders();
    case "recompute-daily-stats": {
      // Yesterday (UTC): the day just closed is the first point that's
      // fully final and worth denormalizing.
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return recomputeDailyStatsForAllTeachers(yesterday);
    }
    default:
      throw new Error(`Unknown job: ${name}`);
  }
}
