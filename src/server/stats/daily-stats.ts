// No `import "server-only"` here (unlike stats.ts): this module is also
// invoked from CLI/worker scripts (`pnpm worker`, `pnpm stats:backfill`) via
// plain `tsx`, which — unlike Next's bundler — can't resolve that marker
// package. Same convention as `server/notifications/*-reminders.ts`.

import { prisma } from "@/lib/prisma";
import { startOfDayUTC } from "@/lib/stats-period";
import {
  LessonStatus,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Denormalizes one UTC day of a teacher's activity into `DailyStats` — the
 * backing store for the "full history" monthly trend chart, so that chart
 * doesn't re-scan every `Lesson`/`Payment` row on every dashboard load. Idle
 * to call more than once for the same day (upsert); safe to re-run for a past
 * day if data changed after the fact (e.g. a late payment).
 */
export async function recomputeDailyStats(
  teacherId: string,
  date: Date,
): Promise<void> {
  const day = startOfDayUTC(date);
  const nextDay = new Date(day.getTime() + DAY_MS);

  const [
    lessons,
    paidAgg,
    invoicedAgg,
    outstandingAgg,
    newStudents,
    activeStudentRows,
    reviewedCount,
  ] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId, scheduledStart: { gte: day, lt: nextDay } },
      select: { status: true },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        teacherId,
        status: PaymentStatus.PAID,
        paidAt: { gte: day, lt: nextDay },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { teacherId, issuedAt: { gte: day, lt: nextDay } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        teacherId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        createdAt: { lt: nextDay },
      },
    }),
    prisma.user.count({
      where: {
        tenantId: teacherId,
        role: UserRole.STUDENT,
        createdAt: { gte: day, lt: nextDay },
      },
    }),
    prisma.lesson.findMany({
      where: {
        teacherId,
        status: LessonStatus.COMPLETED,
        scheduledStart: { gte: day, lt: nextDay },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.aIReview.count({
      where: { teacherId, createdAt: { gte: day, lt: nextDay } },
    }),
  ]);

  const counts = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
  for (const l of lessons) {
    if (l.status === LessonStatus.SCHEDULED) counts.scheduled++;
    else if (l.status === LessonStatus.COMPLETED) counts.completed++;
    else if (l.status === LessonStatus.CANCELLED) counts.cancelled++;
    else if (l.status === LessonStatus.NO_SHOW) counts.noShow++;
  }

  const data = {
    lessonsScheduled: counts.scheduled,
    lessonsCompleted: counts.completed,
    lessonsCancelled: counts.cancelled,
    lessonsNoShow: counts.noShow,
    revenue: paidAgg._sum.amount ?? 0,
    invoiced: invoicedAgg._sum.totalAmount ?? 0,
    outstanding: outstandingAgg._sum.amount ?? 0,
    newStudents,
    activeStudents: activeStudentRows.length,
    submissionsReviewed: reviewedCount,
    currency: "UAH",
  };

  await prisma.dailyStats.upsert({
    where: { teacherId_date: { teacherId, date: day } },
    create: { teacherId, date: day, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

/** Recomputes `DailyStats` for every teacher for a single UTC day (the nightly job). */
export async function recomputeDailyStatsForAllTeachers(
  date: Date,
): Promise<{ teachers: number }> {
  const teachers = await prisma.user.findMany({
    where: { role: UserRole.TEACHER },
    select: { id: true },
  });
  for (const teacher of teachers) {
    await recomputeDailyStats(teacher.id, date);
  }
  return { teachers: teachers.length };
}

/** Backfills `DailyStats` for one teacher over `[from, to]` — for manual/seed setup. */
export async function backfillDailyStats(
  teacherId: string,
  from: Date,
  to: Date,
): Promise<{ days: number }> {
  let cursor = startOfDayUTC(from);
  const end = startOfDayUTC(to);
  let days = 0;
  while (cursor.getTime() <= end.getTime()) {
    await recomputeDailyStats(teacherId, cursor);
    cursor = new Date(cursor.getTime() + DAY_MS);
    days++;
  }
  return { days };
}
