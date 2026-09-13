import IORedis from "ioredis";

import { env } from "@/lib/env";

/** Shared Redis connection for BullMQ. `maxRetriesPerRequest: null` is required. */
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
