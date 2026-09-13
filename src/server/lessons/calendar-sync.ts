import "server-only";

import { prisma } from "@/lib/prisma";
import { CalendarSyncStatus, LessonStatus } from "@/generated/prisma/enums";
import { isGoogleCalendarConfigured } from "@/server/integrations/google/config";
import { getFreshAccessToken } from "@/server/integrations/google/client";
import { buildLessonEvent } from "@/server/integrations/google/event";
import {
  deleteEvent,
  insertEvent,
  patchEvent,
} from "@/server/integrations/google/calendar";

/**
 * Outbound (app -> Google) calendar sync. Called from the lesson Server Actions
 * *after* the DB write succeeds. It never throws: a Google failure is recorded
 * on `CalendarEvent` (`syncStatus = FAILED`, `syncError`) and surfaced in the UI
 * with a "retry" button — the lesson mutation still stands.
 */

export type CalendarSyncOutcome =
  | { status: "synced"; htmlLink: string | null }
  | {
      status: "skipped";
      reason: "not-configured" | "not-connected" | "nothing-to-do";
    }
  | { status: "failed"; error: string };

export type DeletedLessonCalendarRef = {
  googleEventId: string | null;
  googleCalendarId: string | null;
};

export type LessonSyncState = {
  syncStatus: CalendarSyncStatus;
  syncError: string | null;
  htmlLink: string | null;
  lastSyncedAt: Date | null;
};

/** Calendar sync state for one lesson, for the detail page. */
export async function getLessonSyncState(
  teacherId: string,
  lessonId: string,
): Promise<LessonSyncState | null> {
  const row = await prisma.calendarEvent.findFirst({
    where: { lessonId, teacherId },
    select: {
      syncStatus: true,
      syncError: true,
      htmlLink: true,
      lastSyncedAt: true,
    },
  });
  return row;
}

async function recordFailure(
  teacherId: string,
  lessonId: string,
  message: string,
): Promise<void> {
  const syncError = message.slice(0, 500);
  await prisma.calendarEvent.upsert({
    where: { lessonId },
    create: {
      lessonId,
      teacherId,
      syncStatus: CalendarSyncStatus.FAILED,
      syncError,
      lastSyncedAt: new Date(),
    },
    update: {
      syncStatus: CalendarSyncStatus.FAILED,
      syncError,
      lastSyncedAt: new Date(),
    },
  });
}

/** Create / update / cancel the Google event for a lesson. */
export async function syncLessonToGoogle(
  teacherId: string,
  lessonId: string,
  timezone: string,
): Promise<CalendarSyncOutcome> {
  if (!isGoogleCalendarConfigured()) {
    return { status: "skipped", reason: "not-configured" };
  }

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    include: {
      student: { select: { name: true, email: true } },
      calendarEvent: {
        select: { googleEventId: true, googleCalendarId: true },
      },
    },
  });
  if (!lesson) {
    return { status: "failed", error: "lesson not found" };
  }

  try {
    const token = await getFreshAccessToken(teacherId);
    if (!token) return { status: "skipped", reason: "not-connected" };

    const calendarId =
      lesson.calendarEvent?.googleCalendarId ?? token.calendarId;
    const existingEventId = lesson.calendarEvent?.googleEventId ?? null;
    const event = buildLessonEvent({
      subject: lesson.subject,
      studentName: lesson.student.name,
      studentEmail: lesson.student.email,
      scheduledStart: lesson.scheduledStart,
      scheduledEnd: lesson.scheduledEnd,
      status: lesson.status,
      meetLink: lesson.meetLink,
      notes: lesson.notes,
      timezone,
    });

    if (lesson.status === LessonStatus.CANCELLED) {
      if (existingEventId) {
        await deleteEvent(token.accessToken, calendarId, existingEventId);
      }
      await prisma.calendarEvent.upsert({
        where: { lessonId },
        create: {
          lessonId,
          teacherId,
          googleCalendarId: calendarId,
          syncStatus: CalendarSyncStatus.DELETED,
          lastSyncedAt: new Date(),
          syncError: null,
        },
        update: {
          googleEventId: null,
          syncStatus: CalendarSyncStatus.DELETED,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
      return { status: "synced", htmlLink: null };
    }

    const result = existingEventId
      ? await patchEvent(token.accessToken, calendarId, existingEventId, event)
      : await insertEvent(token.accessToken, calendarId, event);

    await prisma.calendarEvent.upsert({
      where: { lessonId },
      create: {
        lessonId,
        teacherId,
        googleEventId: result.id,
        googleCalendarId: calendarId,
        htmlLink: result.htmlLink,
        hangoutLink: result.hangoutLink,
        syncStatus: CalendarSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null,
      },
      update: {
        googleEventId: result.id,
        googleCalendarId: calendarId,
        htmlLink: result.htmlLink,
        hangoutLink: result.hangoutLink,
        syncStatus: CalendarSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null,
      },
    });

    return { status: "synced", htmlLink: result.htmlLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordFailure(teacherId, lessonId, message).catch(() => undefined);
    return { status: "failed", error: message };
  }
}

/** Remove the Google event for a lesson that was hard-deleted from the app. */
export async function removeLessonFromGoogle(
  teacherId: string,
  ref: DeletedLessonCalendarRef,
): Promise<CalendarSyncOutcome> {
  if (!isGoogleCalendarConfigured()) {
    return { status: "skipped", reason: "not-configured" };
  }
  if (!ref.googleEventId) {
    return { status: "skipped", reason: "nothing-to-do" };
  }

  try {
    const token = await getFreshAccessToken(teacherId);
    if (!token) return { status: "skipped", reason: "not-connected" };
    await deleteEvent(
      token.accessToken,
      ref.googleCalendarId ?? token.calendarId,
      ref.googleEventId,
    );
    return { status: "synced", htmlLink: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The lesson row (and its CalendarEvent) is already gone — nothing to
    // persist the failure onto; log and move on.
    console.error(
      `[calendar-sync] delete for deleted lesson failed: ${message}`,
    );
    return { status: "failed", error: message };
  }
}
