import { describe, expect, it } from "vitest";

import {
  lessonReminderKey,
  lessonReminderOffset,
  needsPaymentReminder,
  paymentReminderKey,
} from "@/lib/reminder-rules";

const now = new Date("2026-04-01T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("lessonReminderOffset", () => {
  it("returns 1h within the last hour", () => {
    expect(lessonReminderOffset(inHours(0.5), now)).toBe("1h");
    expect(lessonReminderOffset(inHours(1), now)).toBe("1h");
  });
  it("returns 24h between 1h and 24h out", () => {
    expect(lessonReminderOffset(inHours(2), now)).toBe("24h");
    expect(lessonReminderOffset(inHours(24), now)).toBe("24h");
  });
  it("returns null past the lesson or beyond 24h", () => {
    expect(lessonReminderOffset(inHours(-1), now)).toBeNull();
    expect(lessonReminderOffset(inHours(0), now)).toBeNull();
    expect(lessonReminderOffset(inHours(25), now)).toBeNull();
  });
  it("keys are stable per lesson+offset", () => {
    expect(lessonReminderKey("l1", "1h")).toBe("lesson:l1:1h");
  });
});

describe("needsPaymentReminder", () => {
  it("fires when all paid lessons are done and one is upcoming", () => {
    expect(
      needsPaymentReminder({
        paidCount: 4,
        completedCount: 4,
        upcomingCount: 1,
      }),
    ).toBe(true);
    expect(
      needsPaymentReminder({
        paidCount: 4,
        completedCount: 6,
        upcomingCount: 2,
      }),
    ).toBe(true);
  });
  it("does not fire when still within the paid balance", () => {
    expect(
      needsPaymentReminder({
        paidCount: 4,
        completedCount: 3,
        upcomingCount: 1,
      }),
    ).toBe(false);
  });
  it("does not fire without an upcoming lesson or without any completed", () => {
    expect(
      needsPaymentReminder({
        paidCount: 0,
        completedCount: 3,
        upcomingCount: 0,
      }),
    ).toBe(false);
    expect(
      needsPaymentReminder({
        paidCount: 0,
        completedCount: 0,
        upcomingCount: 2,
      }),
    ).toBe(false);
  });
  it("key advances with the completed count", () => {
    expect(paymentReminderKey("s1", 4)).toBe("payment-balance:s1:4");
    expect(paymentReminderKey("s1", 5)).not.toBe(paymentReminderKey("s1", 4));
  });
});
