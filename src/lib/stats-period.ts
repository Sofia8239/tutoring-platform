/**
 * Pure period math for the teacher stats dashboard: resolving a named period
 * (week/month/quarter/year/custom) to a UTC day range, deriving the
 * equal-length preceding/following range for comparison and "upcoming"
 * blocks, and computing a percent delta between two totals. No DB, no
 * `next/*` — mirrors the `stats-buckets.ts` split (pure math vs. `stats.ts`
 * DB fetching).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodKind = "week" | "month" | "quarter" | "year" | "custom";

export type Range = { from: Date; to: Date };

export function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function endOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/**
 * Resolve a named period against `now`, or clamp a `custom` range. All named
 * kinds run from the calendar boundary (Monday / 1st / quarter start / Jan 1)
 * through the end of "today" in UTC — a period always includes today, never
 * the unlived rest of it.
 */
export function resolvePeriod(
  kind: PeriodKind,
  now: Date,
  custom?: Range,
): Range {
  if (kind === "custom") {
    if (!custom) {
      throw new Error('resolvePeriod("custom") requires a custom range');
    }
    const from = startOfDayUTC(custom.from);
    const rawTo = endOfDayUTC(custom.to);
    if (rawTo.getTime() < from.getTime()) {
      throw new Error("custom range: `to` is before `from`");
    }
    const todayEnd = endOfDayUTC(now);
    return { from, to: rawTo.getTime() > todayEnd.getTime() ? todayEnd : rawTo };
  }

  const to = endOfDayUTC(now);
  let from: Date;
  switch (kind) {
    case "week": {
      const daysSinceMonday = (now.getUTCDay() + 6) % 7;
      from = startOfDayUTC(new Date(now.getTime() - daysSinceMonday * DAY_MS));
      break;
    }
    case "month":
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    case "quarter": {
      const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      from = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
      break;
    }
    case "year":
      from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
  }
  return { from, to };
}

function dayCount(range: Range): number {
  const from = startOfDayUTC(range.from);
  const to = startOfDayUTC(range.to);
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/** The equal-length range immediately before `range.from` (for MoM-style comparisons). */
export function previousRange(range: Range): Range {
  const days = dayCount(range);
  const from = startOfDayUTC(range.from);
  const to = new Date(from.getTime() - 1);
  return { from: new Date(from.getTime() - days * DAY_MS), to };
}

/** The equal-length range immediately after `range.to` (for "upcoming" blocks). */
export function nextRange(range: Range): Range {
  const days = dayCount(range);
  const to = endOfDayUTC(range.to);
  const from = new Date(to.getTime() + 1);
  return { from, to: new Date(from.getTime() + days * DAY_MS - 1) };
}

export type Delta = { current: number; previous: number; percent: number | null };

/**
 * Percent change from `previous` to `current`. `null` means "undefined" (grew
 * from a zero base) rather than a misleading +Infinity — the UI should render
 * that as "new" / "—", not a percentage.
 */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function toDelta(current: number, previous: number): Delta {
  return { current, previous, percent: percentDelta(current, previous) };
}
