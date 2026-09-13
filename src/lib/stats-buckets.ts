import { z } from "zod";

/**
 * Pure helpers for on-demand stats aggregation: bucket rows into calendar days
 * (UTC) and tally AI-review error types. No DB, no `next/*`.
 */

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sum `value(row)` per `dayKey(date(row))`. */
export function bucketByDay<T>(
  rows: readonly T[],
  date: (row: T) => Date,
  value: (row: T) => number = () => 1,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(date(row));
    out.set(key, (out.get(key) ?? 0) + value(row));
  }
  return out;
}

export type DailyPoint = { date: string; value: number };

/** A dense day-by-day series over `[from, to]`, zero-filled from `buckets`. */
export function fillDailySeries(
  from: Date,
  to: Date,
  buckets: Map<string, number>,
): DailyPoint[] {
  const points: DailyPoint[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (cursor.getTime() <= end) {
    const key = dayKey(cursor);
    points.push({ date: key, value: buckets.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

const errorItemSchema = z.object({ type: z.string().min(1) }).passthrough();
const errorsArraySchema = z.array(errorItemSchema).catch([]);

/** Flatten `errorsJson` arrays across reviews and count occurrences per `type`. */
export function tallyErrorTypes(
  reviews: readonly { errorsJson: unknown }[],
): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const item of errorsArraySchema.parse(review.errorsJson)) {
      const type = item.type.trim() || "інше";
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
