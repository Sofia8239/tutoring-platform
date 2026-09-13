import { describe, expect, it } from "vitest";

import {
  formatInZone,
  timeZoneOffsetMs,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
} from "@/lib/datetime";

const KYIV = "Europe/Kyiv";
const HOUR = 60 * 60 * 1000;

describe("zonedWallTimeToUtc", () => {
  it("uses the summer offset (UTC+3) for Europe/Kyiv", () => {
    expect(zonedWallTimeToUtc("2026-07-15T12:00", KYIV).toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
  });

  it("uses the winter offset (UTC+2) for Europe/Kyiv", () => {
    expect(zonedWallTimeToUtc("2026-01-15T12:00", KYIV).toISOString()).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  it("handles a zone behind UTC", () => {
    // 2026-07-15 is DST in New York → UTC-4.
    expect(
      zonedWallTimeToUtc("2026-07-15T12:00", "America/New_York").toISOString(),
    ).toBe("2026-07-15T16:00:00.000Z");
  });

  it("accepts seconds and a space separator", () => {
    expect(zonedWallTimeToUtc("2026-01-15 12:00:30", KYIV).toISOString()).toBe(
      "2026-01-15T10:00:30.000Z",
    );
  });

  it("rejects a non-wall-clock string", () => {
    expect(() => zonedWallTimeToUtc("15/01/2026 12:00", KYIV)).toThrow();
  });

  it("still returns a valid instant inside the spring-forward gap", () => {
    // Kyiv clocks jump 03:00 -> 04:00 on 2026-03-29; 03:30 does not exist.
    const d = zonedWallTimeToUtc("2026-03-29T03:30", KYIV);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});

describe("utcToZonedWallTime", () => {
  it("is the inverse of zonedWallTimeToUtc for unambiguous times", () => {
    for (const wall of ["2026-07-15T08:30", "2026-01-15T22:00"]) {
      expect(utcToZonedWallTime(zonedWallTimeToUtc(wall, KYIV), KYIV)).toBe(
        wall,
      );
    }
  });
});

describe("timeZoneOffsetMs", () => {
  it("is zero for UTC", () => {
    expect(timeZoneOffsetMs(new Date("2026-07-15T00:00:00Z"), "UTC")).toBe(0);
  });

  it("is +3h for Kyiv in summer and +2h in winter", () => {
    expect(timeZoneOffsetMs(new Date("2026-07-15T00:00:00Z"), KYIV)).toBe(
      3 * HOUR,
    );
    expect(timeZoneOffsetMs(new Date("2026-01-15T00:00:00Z"), KYIV)).toBe(
      2 * HOUR,
    );
  });
});

describe("formatInZone", () => {
  it("renders the local wall time for the zone", () => {
    const out = formatInZone(new Date("2026-07-15T09:00:00Z"), KYIV, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(out).toBe("12:00");
  });
});
