import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/server/notifications/mailer";
import {
  NotificationChannel,
  NotificationType,
} from "@/generated/prisma/enums";

/**
 * Deliver one notification. Idempotent on `(userId, dedupeKey)` — the DB unique
 * constraint means re-running a scan never double-sends. When `email` is given
 * and the row was freshly created, an email goes out too and `sentAt` is set.
 */
export async function deliverNotification(input: {
  userId: string;
  teacherId: string;
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  email?: { to: string } | null;
}): Promise<{ created: boolean }> {
  const existing = await prisma.notification.findUnique({
    where: {
      userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey },
    },
    select: { id: true },
  });
  if (existing) return { created: false };

  let notification;
  try {
    notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        teacherId: input.teacherId,
        type: input.type,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
        channel: input.email
          ? NotificationChannel.EMAIL
          : NotificationChannel.IN_APP,
      },
      select: { id: true },
    });
  } catch {
    // Lost a race on the unique (userId, dedupeKey) — already delivered.
    return { created: false };
  }

  if (input.email) {
    const result = await sendEmail({
      to: input.email.to,
      subject: input.title,
      text: input.body,
    });
    if (result.ok) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    }
  }

  return { created: true };
}
