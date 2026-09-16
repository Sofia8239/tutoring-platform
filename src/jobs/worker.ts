import "dotenv/config";

import { Worker } from "bullmq";

import { env } from "@/lib/env";
import { redisConnection } from "@/jobs/redis";
import {
  REMINDERS_QUEUE,
  remindersQueue,
  type ReminderJobName,
} from "@/jobs/queue";
import { runReminderJob } from "@/jobs/reminders";

/**
 * Reminders + stats worker (`pnpm worker`). Runs as its own process next to
 * `next`. Registers repeatable scans and processes them:
 *   - scan-lessons: every REMINDERS_SCAN_EVERY_MINUTES (default 10) → 24h + 1h
 *     lesson reminders to teacher + student.
 *   - scan-payments: daily → "pay for the next block" reminders to students.
 *   - recompute-daily-stats: nightly (02:00 UTC) → denormalizes yesterday
 *     into `DailyStats` for every teacher, backing the stats dashboard's
 *     full-history trend chart.
 */
async function main() {
  const everyLessons = env.REMINDERS_SCAN_EVERY_MINUTES * 60_000;

  await remindersQueue.upsertJobScheduler(
    "scan-lessons",
    { every: everyLessons },
    { name: "scan-lessons" },
  );
  await remindersQueue.upsertJobScheduler(
    "scan-payments",
    { every: 24 * 60 * 60_000 },
    { name: "scan-payments" },
  );
  await remindersQueue.upsertJobScheduler(
    "recompute-daily-stats",
    { pattern: "0 2 * * *" },
    { name: "recompute-daily-stats" },
  );

  const worker = new Worker(
    REMINDERS_QUEUE,
    async (job) => {
      const result = await runReminderJob(job.name as ReminderJobName);
      console.log(`[worker] ${job.name}`, result);
      return result;
    },
    { connection: redisConnection, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name ?? "?"} failed: ${err.message}`);
  });
  console.log("[worker] reminders worker started");

  const shutdown = async () => {
    console.log("[worker] shutting down…");
    await worker.close();
    await remindersQueue.close();
    redisConnection.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker] fatal:", error);
  process.exit(1);
});
