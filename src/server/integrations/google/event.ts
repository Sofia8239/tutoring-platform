import { LessonStatus } from "@/generated/prisma/enums";

/**
 * Pure mapping from a lesson to a Google Calendar event body. No network, no
 * Prisma — unit tested directly.
 *
 * The meeting link is a permanent Zoom/Meet URL the teacher owns (see
 * `src/lib/meeting-url.ts`); we put it in `location` + `description` rather than
 * asking Google to mint a Meet link.
 */

export type GoogleCalendarEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: "confirmed" | "cancelled";
};

export type LessonEventSource = {
  subject: string;
  studentName: string | null;
  studentEmail: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: LessonStatus;
  meetLink: string | null;
  notes: string | null;
  timezone: string;
};

export function buildLessonEvent(
  source: LessonEventSource,
): GoogleCalendarEventInput {
  const who = source.studentName?.trim() || source.studentEmail;

  const descriptionParts = [
    source.notes?.trim() || null,
    source.meetLink ? `Посилання на зустріч: ${source.meetLink}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    summary: `${source.subject} — ${who}`,
    ...(descriptionParts.length
      ? { description: descriptionParts.join("\n\n") }
      : {}),
    ...(source.meetLink ? { location: source.meetLink } : {}),
    start: {
      dateTime: source.scheduledStart.toISOString(),
      timeZone: source.timezone,
    },
    end: {
      dateTime: source.scheduledEnd.toISOString(),
      timeZone: source.timezone,
    },
    status:
      source.status === LessonStatus.CANCELLED ? "cancelled" : "confirmed",
  };
}
