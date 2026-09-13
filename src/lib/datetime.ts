/**
 * Timezone helpers. Golden rule 1 needs reconstructable history, so every
 * timestamp is stored in UTC (Prisma `DateTime` -> Postgres `timestamptz`).
 *
 * A teacher schedules in their own wall-clock time (`User.timezone`, an IANA
 * name). These helpers convert between that wall-clock string — the value an
 * `<input type="datetime-local">` produces, `"YYYY-MM-DDTHH:mm"` — and a real
 * UTC instant, using only `Intl` so there is no extra dependency.
 */

const WALL_CLOCK_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Offset of `timeZone` from UTC at the given instant, in milliseconds
 * (positive when the zone is ahead of UTC, e.g. +3h for Europe/Kyiv in summer).
 */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - instant.getTime();
}

/**
 * Interpret a `"YYYY-MM-DDTHH:mm"` wall-clock string as a local time in
 * `timeZone` and return the matching UTC instant. Resolves the DST ambiguity by
 * re-checking the offset at the candidate instant (good enough for scheduling:
 * the "spring forward" gap and "fall back" overlap pick the post-transition
 * offset).
 */
export function zonedWallTimeToUtc(wallClock: string, timeZone: string): Date {
  const match = WALL_CLOCK_RE.exec(wallClock.trim());
  if (!match) {
    throw new Error(`Not a wall-clock datetime: ${JSON.stringify(wallClock)}`);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  const firstGuessOffset = timeZoneOffsetMs(new Date(naiveUtc), timeZone);
  let utc = naiveUtc - firstGuessOffset;

  const refinedOffset = timeZoneOffsetMs(new Date(utc), timeZone);
  if (refinedOffset !== firstGuessOffset) {
    utc = naiveUtc - refinedOffset;
  }

  return new Date(utc);
}

/**
 * Inverse of {@link zonedWallTimeToUtc}: the `"YYYY-MM-DDTHH:mm"` a
 * `datetime-local` input should show for `instant` when edited in `timeZone`.
 */
export function utcToZonedWallTime(instant: Date, timeZone: string): string {
  const shifted = new Date(
    instant.getTime() + timeZoneOffsetMs(instant, timeZone),
  );
  return shifted.toISOString().slice(0, 16);
}

/** Locale-aware display of a UTC instant in a given zone, e.g. "15.09.2026, 17:00". */
export function formatInZone(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
  locale = "uk-UA",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
    instant,
  );
}
