import { describe, expect, it } from "vitest";

import {
  bucketByDay,
  dayKey,
  fillDailySeries,
  tallyErrorTypes,
} from "@/lib/stats-buckets";

describe("bucketByDay + fillDailySeries", () => {
  it("sums values per UTC day and zero-fills the range", () => {
    const rows = [
      { d: new Date("2026-03-01T10:00:00Z"), v: 100 },
      { d: new Date("2026-03-01T22:00:00Z"), v: 50 },
      { d: new Date("2026-03-03T09:00:00Z"), v: 30 },
    ];
    const buckets = bucketByDay(
      rows,
      (r) => r.d,
      (r) => r.v,
    );
    expect(buckets.get("2026-03-01")).toBe(150);

    const series = fillDailySeries(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-04T00:00:00Z"),
      buckets,
    );
    expect(series).toEqual([
      { date: "2026-03-01", value: 150 },
      { date: "2026-03-02", value: 0 },
      { date: "2026-03-03", value: 30 },
      { date: "2026-03-04", value: 0 },
    ]);
  });

  it("counts rows when no value fn is given", () => {
    const rows = [
      { d: new Date("2026-03-02T01:00:00Z") },
      { d: new Date("2026-03-02T23:00:00Z") },
    ];
    expect(bucketByDay(rows, (r) => r.d).get("2026-03-02")).toBe(2);
  });

  it("dayKey is UTC calendar date", () => {
    expect(dayKey(new Date("2026-03-01T23:59:59Z"))).toBe("2026-03-01");
  });
});

describe("tallyErrorTypes", () => {
  it("flattens and counts error types across reviews, sorted desc", () => {
    const reviews = [
      {
        errorsJson: [
          { type: "арифметика", severity: "major" },
          { type: "формула", severity: "minor" },
        ],
      },
      { errorsJson: [{ type: "арифметика" }] },
      { errorsJson: "not an array" },
      { errorsJson: null },
    ];
    expect(tallyErrorTypes(reviews)).toEqual([
      { type: "арифметика", count: 2 },
      { type: "формула", count: 1 },
    ]);
  });
});
