import { prisma } from "@/lib/prisma";
import { needsPaymentReminder, paymentReminderKey } from "@/lib/reminder-rules";
import { deliverNotification } from "@/server/notifications/notify";
import {
  LessonStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";

/**
 * Phase 8. For each student who has conducted every lesson they paid for and
 * still has a lesson ahead, remind them (the student only) to pay for the next
 * block. Fires once per newly-completed unpaid lesson (key includes the
 * completed count).
 */
export async function scanPaymentReminders(
  now: Date = new Date(),
): Promise<{ scanned: number; sent: number }> {
  const students = await prisma.user.findMany({
    where: { role: UserRole.STUDENT, isActive: true },
    select: { id: true, email: true, tenantId: true },
  });

  let sent = 0;
  for (const student of students) {
    if (!student.tenantId) continue;

    const [paidCount, completedCount, upcomingCount] = await Promise.all([
      prisma.payment.count({
        where: { studentId: student.id, status: PaymentStatus.PAID },
      }),
      prisma.lesson.count({
        where: { studentId: student.id, status: LessonStatus.COMPLETED },
      }),
      prisma.lesson.count({
        where: {
          studentId: student.id,
          status: LessonStatus.SCHEDULED,
          scheduledStart: { gt: now },
        },
      }),
    ]);

    if (!needsPaymentReminder({ paidCount, completedCount, upcomingCount })) {
      continue;
    }

    const owed = completedCount - paidCount;
    const res = await deliverNotification({
      userId: student.id,
      teacherId: student.tenantId,
      type: NotificationType.PAYMENT_DUE,
      title: "Нагадування про оплату",
      body:
        owed <= 0
          ? "Ви провели всі оплачені заняття. Будь ласка, оплатіть наступні."
          : `Не оплачено занять: ${owed}. Будь ласка, поповніть баланс, щоб продовжити навчання.`,
      dedupeKey: paymentReminderKey(student.id, completedCount),
      email: { to: student.email },
    });
    if (res.created) sent++;
  }

  return { scanned: students.length, sent };
}
