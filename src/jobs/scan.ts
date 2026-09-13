import "dotenv/config";

import { runReminderJob } from "@/jobs/reminders";
import type { ReminderJobName } from "@/jobs/queue";

/**
 * One-shot reminder scan, no queue — for testing / cron.
 *   pnpm worker:scan lessons
 *   pnpm worker:scan payments
 */
const arg = process.argv[2];
const job: ReminderJobName | null =
  arg === "lessons"
    ? "scan-lessons"
    : arg === "payments"
      ? "scan-payments"
      : null;

if (!job) {
  console.error("usage: worker:scan <lessons|payments>");
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
