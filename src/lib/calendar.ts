import { utcToZonedWallTime } from "./datetime";

/**
 * Pure helpers for the weekly lessons calendar (Google-Calendar-style grid).
 * No `server-only`, no deps — the client grid component imports this directly.
 * All "date" values are `"YYYY-MM-DD"` strings; all times are minutes-from-
 * midnight in the teacher's own timezone.
 */

const NOON = "T12:00:00Z";

/** `"YYYY-MM-DD"` of the Monday on or before `dateISO`. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}${NOON}`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Shift a `"YYYY-MM-DD"` string by whole days. */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}${NOON}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven `"YYYY-MM-DD"` strings of the week starting at `mondayISO`. */
export function weekDaysISO(mondayISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));
}

/** `{ dateISO, minutes }` of a UTC instant as read in `timezone`. */
export function zonedDayAndMinutes(
  instant: Date,
  timezone: string,
): { dateISO: string; minutes: number } {
  const wall = utcToZonedWallTime(instant, timezone); // "YYYY-MM-DDTHH:mm"
  return {
    dateISO: wall.slice(0, 10),
    minutes: Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16)),
  };
}

export type CalendarLesson = {
  id: string;
  subject: string;
  personName: string;
  /** ISO strings — serialisable across the server/client boundary. */
  startISO: string;
  endISO: string;
  status: string;
};

/** A lesson placed on one day column: vertical span + horizontal lane. */
export type PlacedLesson = CalendarLesson & {
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
};

/**
 * Assign side-by-side lanes to lessons that overlap in time (same approach as
 * Google Calendar). Non-overlapping lessons each get a full-width lane 0/1.
 */
export function layoutDayLessons(
  lessons: Array<CalendarLesson & { startMin: number; endMin: number }>,
): PlacedLesson[] {
  const sorted = [...lessons].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );

  const placed: PlacedLesson[] = [];
  let cluster: PlacedLesson[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneCount = cluster.reduce((m, l) => Math.max(m, l.lane + 1), 1);
    for (const l of cluster) l.laneCount = laneCount;
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const l of sorted) {
    if (cluster.length > 0 && l.startMin >= clusterEnd) flush();

    const taken = new Set(
      cluster.filter((c) => c.endMin > l.startMin).map((c) => c.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;

    cluster.push({ ...l, lane, laneCount: 1 });
    clusterEnd = Math.max(clusterEnd, l.endMin);
  }
  if (cluster.length > 0) flush();

  return placed;
}

/**
 * The hour the grid should open scrolled to: an hour before the earliest
 * lesson of the visible week, or before "now" if today is in it and there
 * are no lessons yet, or a plain mid-morning default. The grid itself always
 * spans the full 00:00-24:00 day — this only picks where it opens.
 */
export function initialScrollHour(
  lessons: Array<{ startMin: number; endMin: number }>,
  nowMinutes: number | null,
  fallbackHour = 8,
): number {
  if (lessons.length > 0) {
    const earliest = Math.min(...lessons.map((l) => l.startMin));
    return Math.max(0, Math.floor(earliest / 60) - 1);
  }
  if (nowMinutes !== null) {
    return Math.max(0, Math.floor(nowMinutes / 60) - 1);
  }
  return fallbackHour;
}
