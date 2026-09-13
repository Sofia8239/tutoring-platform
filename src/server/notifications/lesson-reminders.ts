import { prisma } from "@/lib/prisma";
import { formatInZone } from "@/lib/datetime";
import { lessonReminderKey, lessonReminderOffset } from "@/lib/reminder-rules";
import { deliverNotification } from "@/server/notifications/notify";
import { LessonStatus, NotificationType } from "@/generated/prisma/enums";

const HOUR = 60 * 60 * 1000;

/**
 * Notify the teacher AND the student about scheduled lessons starting within
 * 24h (once) and within 1h (once). Idempotent via `deliverNotification`.
 */
export async function scanLessonReminders(
  now: Date = new Date(),
): Promise<{ scanned: number; sent: number }> {
  const lessons = await prisma.lesson.findMany({
    where: {
      status: LessonStatus.SCHEDULED,
      scheduledStart: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) },
    },
    select: {
      id: true,
      subject: true,
      scheduledStart: true,
      teacher: { select: { id: true, email: true, timezone: true } },
      student: { select: { id: true, email: true, timezone: true } },
    },
  });

  let sent = 0;
  for (const lesson of lessons) {
    const offset = lessonReminderOffset(lesson.scheduledStart, now);
    if (!offset) continue;

    const dedupeKey = lessonReminderKey(lesson.id, offset);
    const title =
      offset === "1h" ? "Урок за годину" : "Нагадування: завтра урок";

    for (const person of [lesson.teacher, lesson.student]) {
      const when = formatInZone(lesson.scheduledStart, person.timezone);
      const body = `«${lesson.subject}» — ${when}.`;
      const res = await deliverNotification({
        userId: person.id,
        teacherId: lesson.teacher.id,
        type: NotificationType.LESSON_REMINDER,
        title,
        body,
        dedupeKey,
        email: { to: person.email },
      });
      if (res.created) sent++;
    }
  }

  return { scanned: lessons.length, sent };
}
