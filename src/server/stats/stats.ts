import "server-only";

import { prisma } from "@/lib/prisma";
import { sumMinor } from "@/lib/money";
import {
  bucketByDay,
  bucketByMonth,
  fillDailySeries,
  monthKey,
  monthRangeKeys,
  sumUnpaidPrices,
  tallyErrorTypes,
  type DailyPoint,
} from "@/lib/stats-buckets";
import {
  nextRange,
  previousRange,
  resolvePeriod,
  toDelta,
  type Delta,
  type PeriodKind,
  type Range,
} from "@/lib/stats-period";
import {
  LessonStatus,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";

export type { PeriodKind, Range } from "@/lib/stats-period";

/**
 * Teacher dashboard stats. Three kinds of numbers, never mixed:
 *  - `current` / `previous` / `deltas`: PAST, fact — real rows from the DB
 *    for the selected period and the equal-length period before it.
 *  - `upcoming`: FUTURE, but still fact — the sum of lessons *already on the
 *    schedule*, not a projection. Labelled "заплановано / очікується" in the UI.
 *  - `monthlyTrend`: both, explicitly split per point (`*Actual` vs.
 *    `*Planned`) so the chart can render solid vs. dashed and the legend can
 *    say which is which. No forecasting (Phase E) here yet.
 *
 * Every query is scoped by `teacherId` (golden rule 7 — multi-tenant).
 * `monthlyTrend`'s past side reads `DailyStats` (nightly-denormalized, see
 * `daily-stats.ts`) instead of scanning the full `Lesson`/`Payment` history
 * on every dashboard load; it's empty until the nightly job — or
 * `pnpm stats:backfill` — has populated it, which the UI renders as an
 * empty state, not an error.
 */

export type PeriodMetrics = {
  lessons: {
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  revenue: number;
  outstanding: number;
  students: { total: number; newInRange: number; activeInRange: number };
};

export type MonthlyTrendPoint = {
  month: string; // "YYYY-MM"
  lessonsActual: number | null;
  lessonsPlanned: number | null;
  revenueActual: number | null;
  revenuePlanned: number | null;
};

export type TeacherStats = {
  period: { kind: PeriodKind; from: string; to: string };
  previousPeriod: { from: string; to: string };
  currency: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltas: {
    revenue: Delta;
    lessonsCompleted: Delta;
    newStudents: Delta;
    activeStudents: Delta;
  };
  upcoming: {
    range: { from: string; to: string };
    lessonsPlanned: number;
    expectedRevenue: number;
  };
  lessonsPerDay: DailyPoint[];
  revenuePerDay: DailyPoint[];
  monthlyTrend: MonthlyTrendPoint[];
  errorTypes: { type: string; count: number }[];
};

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function summarizeLessons(
  lessons: readonly { status: LessonStatus }[],
): PeriodMetrics["lessons"] {
  const counts = { scheduled: 0, completed: 0, cancelled: 0, noShow: 0 };
  for (const l of lessons) {
    if (l.status === LessonStatus.SCHEDULED) counts.scheduled++;
    else if (l.status === LessonStatus.COMPLETED) counts.completed++;
    else if (l.status === LessonStatus.CANCELLED) counts.cancelled++;
    else if (l.status === LessonStatus.NO_SHOW) counts.noShow++;
  }
  return counts;
}

type RawPeriodData = {
  lessons: { status: LessonStatus; scheduledStart: Date }[];
  paidPayments: { amount: number; paidAt: Date | null }[];
  outstanding: number;
  totalStudents: number;
  newStudents: number;
  activeStudents: number;
};

/** Raw fetch for one range — current and previous are both fetched this way. */
async function fetchPeriodData(
  teacherId: string,
  range: Range,
): Promise<RawPeriodData> {
  const { from, to } = range;

  const [
    lessons,
    paidPayments,
    outstandingAgg,
    totalStudents,
    newStudents,
    activeStudentRows,
  ] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId, scheduledStart: { gte: from, lte: to } },
      select: { status: true, scheduledStart: true },
    }),
    prisma.payment.findMany({
      where: {
        teacherId,
        status: PaymentStatus.PAID,
        paidAt: { gte: from, lte: to },
      },
      select: { amount: true, paidAt: true },
    }),
    // "Debt as of the end of this period": still-unpaid payments that
    // already existed by `to`, regardless of when they're due.
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        teacherId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        createdAt: { lte: to },
      },
    }),
    prisma.user.count({
      where: { tenantId: teacherId, role: UserRole.STUDENT, createdAt: { lte: to } },
    }),
    prisma.user.count({
      where: {
        tenantId: teacherId,
        role: UserRole.STUDENT,
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.lesson.findMany({
      where: {
        teacherId,
        status: LessonStatus.COMPLETED,
        scheduledStart: { gte: from, lte: to },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
  ]);

  return {
    lessons,
    paidPayments,
    outstanding: outstandingAgg._sum.amount ?? 0,
    totalStudents,
    newStudents,
    activeStudents: activeStudentRows.length,
  };
}

function toPeriodMetrics(data: RawPeriodData): PeriodMetrics {
  return {
    lessons: summarizeLessons(data.lessons),
    revenue: sumMinor(data.paidPayments.map((p) => p.amount)),
    outstanding: data.outstanding,
    students: {
      total: data.totalStudents,
      newInRange: data.newStudents,
      activeInRange: data.activeStudents,
    },
  };
}

/** Lessons already on the schedule for `range`, and what they're worth unpaid. */
async function fetchUpcoming(
  teacherId: string,
  range: Range,
): Promise<{ lessonsPlanned: number; expectedRevenue: number }> {
  const lessons = await prisma.lesson.findMany({
    where: {
      teacherId,
      status: LessonStatus.SCHEDULED,
      scheduledStart: { gte: range.from, lte: range.to },
    },
    select: {
      price: true,
      payments: { where: { status: PaymentStatus.PAID }, select: { id: true } },
    },
  });

  return {
    lessonsPlanned: lessons.length,
    expectedRevenue: sumUnpaidPrices(
      lessons,
      (l) => l.price,
      (l) => l.payments.length > 0,
    ),
  };
}

const MONTHLY_TREND_MAX_MONTHS_AHEAD = 12;

/**
 * Full-history monthly trend: past months from `DailyStats` (cheap even over
 * years), future months live from already-scheduled lessons (inherently
 * small — nothing to denormalize). `null` on the side that doesn't apply to a
 * month is what lets the chart draw a clean solid/dashed split.
 */
async function getMonthlyTrend(
  teacherId: string,
  now: Date,
): Promise<MonthlyTrendPoint[]> {
  const currentMonthKey = monthKey(now);
  const currentMonthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  const [dailyRows, futureLessons] = await Promise.all([
    prisma.dailyStats.findMany({
      where: { teacherId, date: { lte: now } },
      select: { date: true, lessonsCompleted: true, revenue: true },
    }),
    prisma.lesson.findMany({
      where: {
        teacherId,
        status: LessonStatus.SCHEDULED,
        scheduledStart: { gt: currentMonthEnd },
      },
      select: {
        scheduledStart: true,
        price: true,
        payments: { where: { status: PaymentStatus.PAID }, select: { id: true } },
      },
    }),
  ]);

  if (dailyRows.length === 0 && futureLessons.length === 0) return [];

  const pastLessons = bucketByMonth(dailyRows, (r) => r.date, (r) => r.lessonsCompleted);
  const pastRevenue = bucketByMonth(dailyRows, (r) => r.date, (r) => r.revenue);
  const futureLessonsCount = bucketByMonth(futureLessons, (l) => l.scheduledStart);
  const futureUnpaidRevenue = bucketByMonth(
    futureLessons.filter((l) => l.payments.length === 0),
    (l) => l.scheduledStart,
    (l) => l.price,
  );

  const monthKeys = [
    currentMonthKey,
    ...pastLessons.keys(),
    ...futureLessonsCount.keys(),
  ];
  const earliest = monthKeys.reduce((a, b) => (a < b ? a : b));
  const cap = monthKey(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + MONTHLY_TREND_MAX_MONTHS_AHEAD, 1)),
  );
  const latestSeen = monthKeys.reduce((a, b) => (a > b ? a : b));
  const latest = latestSeen > cap ? cap : latestSeen;

  return monthRangeKeys(earliest, latest).map((month) => {
    const isFuture = month > currentMonthKey;
    return {
      month,
      lessonsActual: isFuture ? null : pastLessons.get(month) ?? 0,
      lessonsPlanned: isFuture ? futureLessonsCount.get(month) ?? 0 : null,
      revenueActual: isFuture ? null : pastRevenue.get(month) ?? 0,
      revenuePlanned: isFuture ? futureUnpaidRevenue.get(month) ?? 0 : null,
    };
  });
}

export async function getTeacherStats(
  teacherId: string,
  kind: PeriodKind,
  now: Date = new Date(),
  custom?: Range,
): Promise<TeacherStats> {
  const range = resolvePeriod(kind, now, custom);
  const previous = previousRange(range);
  const upcoming = nextRange(range);

  const [currentRaw, previousRaw, upcomingData, reviews, monthlyTrend] =
    await Promise.all([
      fetchPeriodData(teacherId, range),
      fetchPeriodData(teacherId, previous),
      fetchUpcoming(teacherId, upcoming),
      prisma.aIReview.findMany({
        where: { teacherId, createdAt: { gte: range.from, lte: range.to } },
        select: { errorsJson: true },
      }),
      getMonthlyTrend(teacherId, now),
    ]);

  const current = toPeriodMetrics(currentRaw);
  const previousMetrics = toPeriodMetrics(previousRaw);
  const completedLessons = currentRaw.lessons.filter(
    (l) => l.status === LessonStatus.COMPLETED,
  );

  return {
    period: { kind, from: iso(range.from), to: iso(range.to) },
    previousPeriod: { from: iso(previous.from), to: iso(previous.to) },
    currency: "UAH",
    current,
    previous: previousMetrics,
    deltas: {
      revenue: toDelta(current.revenue, previousMetrics.revenue),
      lessonsCompleted: toDelta(
        current.lessons.completed,
        previousMetrics.lessons.completed,
      ),
      newStudents: toDelta(
        current.students.newInRange,
        previousMetrics.students.newInRange,
      ),
      activeStudents: toDelta(
        current.students.activeInRange,
        previousMetrics.students.activeInRange,
      ),
    },
    upcoming: {
      range: { from: iso(upcoming.from), to: iso(upcoming.to) },
      lessonsPlanned: upcomingData.lessonsPlanned,
      expectedRevenue: upcomingData.expectedRevenue,
    },
    lessonsPerDay: fillDailySeries(
      range.from,
      range.to,
      bucketByDay(completedLessons, (l) => l.scheduledStart),
    ),
    revenuePerDay: fillDailySeries(
      range.from,
      range.to,
      bucketByDay(
        currentRaw.paidPayments,
        (p) => p.paidAt as Date,
        (p) => p.amount,
      ),
    ),
    monthlyTrend,
    errorTypes: tallyErrorTypes(reviews),
  };
}
