import "server-only";

import { prisma } from "@/lib/prisma";
import {
  bucketByDay,
  fillDailySeries,
  tallyErrorTypes,
  type DailyPoint,
} from "@/lib/stats-buckets";
import {
  LessonStatus,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";

/**
 * Teacher dashboard stats, computed on demand from source tables (no nightly
 * job yet). `recomputeDailyStats` is provided for a future BullMQ worker to
 * denormalise into `DailyStats` at scale. Every query is scoped by `teacherId`.
 */

export type TeacherStats = {
  range: { from: string; to: string };
  currency: string;
  lessons: {
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  revenue: number;
  outstanding: number;
  students: { total: number; newInRange: number; activeInRange: number };
  lessonsPerDay: DailyPoint[];
  revenuePerDay: DailyPoint[];
  errorTypes: { type: string; count: number }[];
};

export async function getTeacherStats(
  teacherId: string,
  range: { from: Date; to: Date },
): Promise<TeacherStats> {
  const { from, to } = range;

  const [
    lessons,
    paidPayments,
    outstandingAgg,
    totalStudents,
    newStudents,
    activeStudentRows,
    reviews,
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
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        teacherId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      },
    }),
    prisma.user.count({
      where: { tenantId: teacherId, role: UserRole.STUDENT },
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
    prisma.aIReview.findMany({
      where: { teacherId, createdAt: { gte: from, lte: to } },
      select: { errorsJson: true },
    }),
  ]);

  const lessonCounts = {
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };
  for (const l of lessons) {
    if (l.status === LessonStatus.SCHEDULED) lessonCounts.scheduled++;
    else if (l.status === LessonStatus.COMPLETED) lessonCounts.completed++;
    else if (l.status === LessonStatus.CANCELLED) lessonCounts.cancelled++;
    else if (l.status === LessonStatus.NO_SHOW) lessonCounts.noShow++;
  }

  const completedLessons = lessons.filter(
    (l) => l.status === LessonStatus.COMPLETED,
  );

  return {
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    currency: "UAH",
    lessons: lessonCounts,
    revenue: paidPayments.reduce((sum, p) => sum + p.amount, 0),
    outstanding: outstandingAgg._sum.amount ?? 0,
    students: {
      total: totalStudents,
      newInRange: newStudents,
      activeInRange: activeStudentRows.length,
    },
    lessonsPerDay: fillDailySeries(
      from,
      to,
      bucketByDay(completedLessons, (l) => l.scheduledStart),
    ),
    revenuePerDay: fillDailySeries(
      from,
      to,
      bucketByDay(
        paidPayments,
        (p) => p.paidAt as Date,
        (p) => p.amount,
      ),
    ),
    errorTypes: tallyErrorTypes(reviews),
  };
}
