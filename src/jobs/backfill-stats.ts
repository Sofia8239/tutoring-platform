import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { backfillDailyStats } from "@/server/stats/daily-stats";

/**
 * One-shot `DailyStats` backfill for local/manual testing of the stats
 * dashboard's full-history trend chart (normally it fills in nightly, one day
 * at a time, via the `recompute-daily-stats` job).
 *   pnpm stats:backfill teacher@tutoring.local [days=180]
 */
async function main() {
  const email = process.argv[2];
  const days = Number(process.argv[3] ?? 180);
  if (!email) {
    console.error("usage: stats:backfill <teacher-email> [days=180]");
    process.exit(1);
  }

  const teacher = await prisma.user.findUnique({ where: { email } });
  if (!teacher) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await backfillDailyStats(teacher.id, from, to);
  console.log(`Backfilled DailyStats for ${email}:`, result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
