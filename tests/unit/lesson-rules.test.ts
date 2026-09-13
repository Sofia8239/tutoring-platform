import { describe, expect, it } from "vitest";

import {
  canTransitionLesson,
  intervalsOverlap,
  timestampFieldForStatus,
  validateLessonWindow,
} from "@/server/lessons/lesson-rules";
import { LessonStatus } from "@/generated/prisma/enums";

const at = (iso: string) => new Date(iso);

describe("canTransitionLesson", () => {
  it("allows SCHEDULED -> each terminal state", () => {
    expect(
      canTransitionLesson(LessonStatus.SCHEDULED, LessonStatus.COMPLETED),
    ).toBe(true);
    expect(
      canTransitionLesson(LessonStatus.SCHEDULED, LessonStatus.CANCELLED),
    ).toBe(true);
    expect(
      canTransitionLesson(LessonStatus.SCHEDULED, LessonStatus.NO_SHOW),
    ).toBe(true);
  });

  it("forbids leaving a terminal state", () => {
    expect(
      canTransitionLesson(LessonStatus.COMPLETED, LessonStatus.SCHEDULED),
    ).toBe(false);
    expect(
      canTransitionLesson(LessonStatus.CANCELLED, LessonStatus.COMPLETED),
    ).toBe(false);
    expect(
      canTransitionLesson(LessonStatus.NO_SHOW, LessonStatus.SCHEDULED),
    ).toBe(false);
  });
});

describe("timestampFieldForStatus", () => {
  it("maps terminal statuses to their timestamp column", () => {
    expect(timestampFieldForStatus(LessonStatus.COMPLETED)).toBe("completedAt");
    expect(timestampFieldForStatus(LessonStatus.CANCELLED)).toBe("cancelledAt");
    expect(timestampFieldForStatus(LessonStatus.NO_SHOW)).toBeNull();
    expect(timestampFieldForStatus(LessonStatus.SCHEDULED)).toBeNull();
  });
});

describe("validateLessonWindow", () => {
  it("passes a normal 60-minute lesson", () => {
    expect(
      validateLessonWindow(at("2026-07-15T09:00Z"), at("2026-07-15T10:00Z")),
    ).toBeNull();
  });

  it("flags end before start", () => {
    expect(
      validateLessonWindow(at("2026-07-15T10:00Z"), at("2026-07-15T09:00Z")),
    ).toBe("end-before-start");
  });

  it("flags an equal start and end", () => {
    expect(
      validateLessonWindow(at("2026-07-15T09:00Z"), at("2026-07-15T09:00Z")),
    ).toBe("end-before-start");
  });

  it("flags a lesson shorter than 15 minutes", () => {
    expect(
      validateLessonWindow(at("2026-07-15T09:00Z"), at("2026-07-15T09:10Z")),
    ).toBe("too-short");
  });

  it("flags a lesson longer than 8 hours", () => {
    expect(
      validateLessonWindow(at("2026-07-15T09:00Z"), at("2026-07-15T18:00Z")),
    ).toBe("too-long");
  });
});

describe("intervalsOverlap", () => {
  const a1 = at("2026-07-15T09:00Z");
  const a2 = at("2026-07-15T10:00Z");

  it("is false when intervals only touch at an endpoint", () => {
    expect(
      intervalsOverlap(
        a1,
        a2,
        at("2026-07-15T10:00Z"),
        at("2026-07-15T11:00Z"),
      ),
    ).toBe(false);
  });

  it("is true for a partial overlap", () => {
    expect(
      intervalsOverlap(
        a1,
        a2,
        at("2026-07-15T09:30Z"),
        at("2026-07-15T10:30Z"),
      ),
    ).toBe(true);
  });

  it("is true when one interval contains the other", () => {
    expect(
      intervalsOverlap(
        a1,
        a2,
        at("2026-07-15T09:15Z"),
        at("2026-07-15T09:45Z"),
      ),
    ).toBe(true);
  });

  it("is false for disjoint intervals", () => {
    expect(
      intervalsOverlap(
        a1,
        a2,
        at("2026-07-15T11:00Z"),
        at("2026-07-15T12:00Z"),
      ),
    ).toBe(false);
  });
});
