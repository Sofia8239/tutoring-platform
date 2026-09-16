import "dotenv/config";

import { runReminderJob } from "@/jobs/reminders";
import type { ReminderJobName } from "@/jobs/queue";

/**
 * One-shot reminder/stats scan, no queue — for testing / cron.
 *   pnpm worker:scan lessons
 *   pnpm worker:scan payments
 *   pnpm worker:scan stats
 */
const arg = process.argv[2];
const job: ReminderJobName | null =
  arg === "lessons"
    ? "scan-lessons"
    : arg === "payments"
      ? "scan-payments"
      : arg === "stats"
        ? "recompute-daily-stats"
        : null;

if (!job) {
  console.error("usage: worker:scan <lessons|payments|stats>");
  process.exit(1);
}

runReminderJob(job)
  .then((result) => {
    console.log(job, result);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
