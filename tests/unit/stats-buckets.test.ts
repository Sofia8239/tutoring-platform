import { describe, expect, it } from "vitest";

import {
  bucketByDay,
  bucketByMonth,
  dayKey,
  fillDailySeries,
  monthKey,
  monthRangeKeys,
  sumUnpaidPrices,
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

describe("bucketByMonth + monthRangeKeys", () => {
  it("sums values per UTC month", () => {
    const rows = [
      { d: new Date("2026-01-05T10:00:00Z"), v: 100 },
      { d: new Date("2026-01-28T22:00:00Z"), v: 50 },
      { d: new Date("2026-02-03T09:00:00Z"), v: 30 },
    ];
    const buckets = bucketByMonth(
      rows,
      (r) => r.d,
      (r) => r.v,
    );
    expect(buckets.get("2026-01")).toBe(150);
    expect(buckets.get("2026-02")).toBe(30);
  });

  it("counts rows when no value fn is given", () => {
    const rows = [
      { d: new Date("2026-01-02T01:00:00Z") },
      { d: new Date("2026-01-20T23:00:00Z") },
    ];
    expect(bucketByMonth(rows, (r) => r.d).get("2026-01")).toBe(2);
  });

  it("monthKey is the UTC calendar month", () => {
    expect(monthKey(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });

  it("monthRangeKeys is dense across a year boundary", () => {
    expect(monthRangeKeys("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("monthRangeKeys handles a single month", () => {
    expect(monthRangeKeys("2026-05", "2026-05")).toEqual(["2026-05"]);
  });
});

describe("sumUnpaidPrices", () => {
  it("sums only rows that are not paid", () => {
    const rows = [
      { price: 300, paid: false },
      { price: 350, paid: true },
      { price: 100, paid: false },
    ];
    expect(sumUnpaidPrices(rows, (r) => r.price, (r) => r.paid)).toBe(400);
  });

  it("is 0 when everything is paid", () => {
    const rows = [{ price: 300, paid: true }];
    expect(sumUnpaidPrices(rows, (r) => r.price, (r) => r.paid)).toBe(0);
  });

  it("is 0 for an empty list", () => {
    expect(sumUnpaidPrices([], (r: { price: number }) => r.price, () => false)).toBe(0);
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
