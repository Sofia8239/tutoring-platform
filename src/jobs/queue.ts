import { Queue } from "bullmq";

import { redisConnection } from "@/jobs/redis";

export const REMINDERS_QUEUE = "reminders";

export type ReminderJobName = "scan-lessons" | "scan-payments";

export const remindersQueue = new Queue(REMINDERS_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
  },
});
