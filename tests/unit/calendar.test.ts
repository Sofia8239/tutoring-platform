import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  gridHourRange,
  layoutDayLessons,
  mondayOf,
  weekDaysISO,
  type CalendarLesson,
} from "@/lib/calendar";

const lesson = (
  id: string,
  startMin: number,
  endMin: number,
): CalendarLesson & { startMin: number; endMin: number } => ({
  id,
  subject: id,
  personName: "X",
  startISO: "2026-09-07T00:00:00.000Z",
  endISO: "2026-09-07T01:00:00.000Z",
  status: "SCHEDULED",
  startMin,
  endMin,
});

describe("mondayOf", () => {
  it("returns the Monday on or before a date", () => {
    expect(mondayOf("2026-09-10")).toBe("2026-09-07"); // Thu -> Mon
    expect(mondayOf("2026-09-07")).toBe("2026-09-07"); // Mon -> itself
    expect(mondayOf("2026-09-13")).toBe("2026-09-07"); // Sun -> prev Mon
  });
});

describe("addDaysISO / weekDaysISO", () => {
  it("shifts across month boundaries", () => {
    expect(addDaysISO("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("lists seven consecutive days", () => {
    expect(weekDaysISO("2026-09-07")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });
});

describe("layoutDayLessons", () => {
  it("gives non-overlapping lessons a single full-width lane", () => {
    const out = layoutDayLessons([
      lesson("a", 540, 600),
      lesson("b", 660, 720),
    ]);
    expect(out.every((l) => l.laneCount === 1 && l.lane === 0)).toBe(true);
  });

  it("splits two overlapping lessons into two lanes", () => {
    const out = layoutDayLessons([
      lesson("a", 540, 660),
      lesson("b", 600, 720),
    ]);
    expect(out.map((l) => [l.id, l.lane, l.laneCount])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("reuses a freed lane after an overlap cluster ends", () => {
    const out = layoutDayLessons([
      lesson("a", 540, 600),
      lesson("b", 550, 610),
      lesson("c", 700, 760), // disjoint -> new cluster, lane 0
    ]);
    const c = out.find((l) => l.id === "c")!;
    expect([c.lane, c.laneCount]).toEqual([0, 1]);
  });
});

describe("gridHourRange", () => {
  it("falls back to a workday when empty", () => {
    expect(gridHourRange([])).toEqual([8, 20]);
  });

  it("expands to fit early / late lessons with an hour of padding", () => {
    expect(gridHourRange([{ startMin: 7 * 60, endMin: 22 * 60 + 30 }])).toEqual(
      [6, 23],
    );
  });
});
