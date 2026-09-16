import { describe, expect, it } from "vitest";

import {
  nextRange,
  percentDelta,
  previousRange,
  resolvePeriod,
  toDelta,
} from "@/lib/stats-period";

// Wednesday 2026-03-18.
const NOW = new Date("2026-03-18T14:30:00Z");

describe("resolvePeriod", () => {
  it("week: Monday through end of today (UTC)", () => {
    const range = resolvePeriod("week", NOW);
    expect(range.from.toISOString()).toBe("2026-03-16T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-18T23:59:59.999Z");
  });

  it("month: the 1st through end of today", () => {
    const range = resolvePeriod("month", NOW);
    expect(range.from.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-18T23:59:59.999Z");
  });

  it("quarter: quarter start through end of today", () => {
    const range = resolvePeriod("quarter", NOW);
    expect(range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("year: Jan 1 through end of today", () => {
    const range = resolvePeriod("year", NOW);
    expect(range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-03-18T23:59:59.999Z");
  });

  it("custom: clamps `to` to end of today when in the future", () => {
    const range = resolvePeriod("custom", NOW, {
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-12-31T00:00:00Z"),
    });
    expect(range.to.toISOString()).toBe("2026-03-18T23:59:59.999Z");
  });

  it("custom: keeps a fully-past `to` as-is (end of that day)", () => {
    const range = resolvePeriod("custom", NOW, {
      from: new Date("2026-01-05T00:00:00Z"),
      to: new Date("2026-01-10T00:00:00Z"),
    });
    expect(range.to.toISOString()).toBe("2026-01-10T23:59:59.999Z");
  });

  it("custom: throws when `to` precedes `from`", () => {
    expect(() =>
      resolvePeriod("custom", NOW, {
        from: new Date("2026-03-10T00:00:00Z"),
        to: new Date("2026-03-01T00:00:00Z"),
      }),
    ).toThrow();
  });

  it("custom: throws without a range", () => {
    expect(() => resolvePeriod("custom", NOW)).toThrow();
  });
});

describe("previousRange / nextRange", () => {
  it("previousRange is the same length, immediately before `from`", () => {
    const range = { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-10T23:59:59.999Z") };
    const prev = previousRange(range);
    expect(prev.to.toISOString()).toBe("2026-02-28T23:59:59.999Z");
    expect(prev.from.toISOString()).toBe("2026-02-19T00:00:00.000Z");
  });

  it("nextRange is the same length, immediately after `to`", () => {
    const range = { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-10T23:59:59.999Z") };
    const next = nextRange(range);
    expect(next.from.toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(next.to.toISOString()).toBe("2026-03-20T23:59:59.999Z");
  });

  it("round-trips a single day", () => {
    const range = { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-03-01T23:59:59.999Z") };
    expect(previousRange(range).from.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(nextRange(range).from.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});

describe("percentDelta / toDelta", () => {
  it("computes a positive change", () => {
    expect(percentDelta(150, 100)).toBe(50);
  });

  it("computes a negative change", () => {
    expect(percentDelta(50, 100)).toBe(-50);
  });

  it("is 0 when both are 0 (no data either period)", () => {
    expect(percentDelta(0, 0)).toBe(0);
  });

  it("is null when growing from a zero base (undefined %, not +Infinity)", () => {
    expect(percentDelta(100, 0)).toBeNull();
  });

  it("toDelta bundles current/previous/percent", () => {
    expect(toDelta(120, 100)).toEqual({ current: 120, previous: 100, percent: 20 });
  });
});
