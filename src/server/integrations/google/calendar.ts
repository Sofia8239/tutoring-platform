import type { GoogleCalendarEventInput } from "@/server/integrations/google/event";

/**
 * Minimal Google Calendar v3 client (events only). Each call takes an access
 * token; refreshing is the caller's job (`client.ts`).
 */

const API_BASE = "https://www.googleapis.com/calendar/v3/calendars";

export class GoogleCalendarError extends Error {}

export type GoogleEventResult = {
  id: string;
  htmlLink: string | null;
  hangoutLink: string | null;
};

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${API_BASE}/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function readResult(res: Response): Promise<GoogleEventResult> {
  const json = (await res.json()) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
  };
  return {
    id: json.id ?? "",
    htmlLink: json.htmlLink ?? null,
    hangoutLink: json.hangoutLink ?? null,
  };
}

async function fail(res: Response, verb: string): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new GoogleCalendarError(
    `Google Calendar ${verb} failed: HTTP ${res.status} ${body.slice(0, 300)}`,
  );
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput,
): Promise<GoogleEventResult> {
  const res = await fetch(eventsUrl(calendarId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) await fail(res, "insert");
  return readResult(res);
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventInput,
): Promise<GoogleEventResult> {
  const res = await fetch(eventsUrl(calendarId, eventId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  // The event was deleted on Google's side — recreate it.
  if (res.status === 404 || res.status === 410) {
    return insertEvent(accessToken, calendarId, event);
  }
  if (!res.ok) await fail(res, "patch");
  return readResult(res);
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(eventsUrl(calendarId, eventId), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Already gone counts as success.
  if (res.ok || res.status === 404 || res.status === 410) return;
  await fail(res, "delete");
}
