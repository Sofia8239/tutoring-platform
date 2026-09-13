import { scanLessonReminders } from "@/server/notifications/lesson-reminders";
import { scanPaymentReminders } from "@/server/notifications/payment-reminders";
import type { ReminderJobName } from "@/jobs/queue";

/** Dispatch a reminder job by name. Shared by the worker and the one-shot CLI. */
export async function runReminderJob(
  name: ReminderJobName,
): Promise<{ scanned: number; sent: number }> {
  switch (name) {
    case "scan-lessons":
      return scanLessonReminders();
    case "scan-payments":
      return scanPaymentReminders();
    default:
      throw new Error(`Unknown reminder job: ${name}`);
  }
}
