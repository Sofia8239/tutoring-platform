/**
 * A "meeting URL" is a permanent video-room link (Zoom, Meet, Jitsi, …) that a
 * teacher reuses across lessons. We only store `http(s)` URLs and keep the
 * parsing rules in one pure, testable place.
 */

const MAX_MEETING_URL_LENGTH = 2048;

export type ParsedMeetingUrl =
  { ok: true; url: string | null } | { ok: false; error: string };

/**
 * Normalise a user-entered meeting link. Empty / whitespace -> `null` (cleared).
 * Anything else must parse as an absolute `http`/`https` URL.
 */
export function parseMeetingUrl(
  raw: string | null | undefined,
): ParsedMeetingUrl {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, url: null };

  if (trimmed.length > MAX_MEETING_URL_LENGTH) {
    return { ok: false, error: "Посилання задовге." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Вкажіть повне посилання, напр. https://zoom.us/j/1234567890",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Посилання має починатися з http:// або https://",
    };
  }

  return { ok: true, url: parsed.toString() };
}
