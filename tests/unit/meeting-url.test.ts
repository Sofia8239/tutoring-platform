import { describe, expect, it } from "vitest";

import { parseMeetingUrl } from "@/lib/meeting-url";

describe("parseMeetingUrl", () => {
  it("treats empty / whitespace as cleared (null)", () => {
    for (const raw of ["", "   ", null, undefined]) {
      expect(parseMeetingUrl(raw)).toEqual({ ok: true, url: null });
    }
  });

  it("accepts an https URL and normalises it", () => {
    expect(parseMeetingUrl("  https://zoom.us/j/123456  ")).toEqual({
      ok: true,
      url: "https://zoom.us/j/123456",
    });
  });

  it("accepts http", () => {
    const result = parseMeetingUrl("http://meet.example.com/room");
    expect(result).toEqual({ ok: true, url: "http://meet.example.com/room" });
  });

  it("rejects a bare string that is not a URL", () => {
    const result = parseMeetingUrl("zoom room 5");
    expect(result.ok).toBe(false);
  });

  it("rejects non-http protocols", () => {
    const result = parseMeetingUrl("ftp://files.example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects an over-long URL", () => {
    const result = parseMeetingUrl(`https://e.com/${"a".repeat(2100)}`);
    expect(result.ok).toBe(false);
  });
});
