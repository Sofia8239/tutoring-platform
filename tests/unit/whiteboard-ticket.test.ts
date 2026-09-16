import { describe, expect, it } from "vitest";

import {
  mintWhiteboardTicket,
  verifyWhiteboardTicket,
} from "@/server/whiteboard-sync/ticket";

const SECRET = "test-secret-not-real";
const payload = {
  lessonId: "lesson_1",
  userId: "user_1",
  role: "teacher" as const,
  name: "Олена",
};

describe("whiteboard ticket", () => {
  it("round-trips a freshly minted ticket", () => {
    const ticket = mintWhiteboardTicket(payload, { secret: SECRET });
    expect(verifyWhiteboardTicket(ticket, SECRET, "lesson_1")).toEqual(payload);
  });

  it("round-trips a student-role ticket the same way", () => {
    const studentPayload = {
      ...payload,
      role: "student" as const,
      userId: "user_2",
    };
    const ticket = mintWhiteboardTicket(studentPayload, { secret: SECRET });
    expect(verifyWhiteboardTicket(ticket, SECRET, "lesson_1")).toEqual(
      studentPayload,
    );
  });

  it("rejects a ticket minted for a different lesson (no room hijacking)", () => {
    const ticket = mintWhiteboardTicket(payload, { secret: SECRET });
    expect(verifyWhiteboardTicket(ticket, SECRET, "lesson_2")).toBeNull();
  });

  it("rejects a wrong secret", () => {
    const ticket = mintWhiteboardTicket(payload, { secret: SECRET });
    expect(
      verifyWhiteboardTicket(ticket, "wrong-secret", "lesson_1"),
    ).toBeNull();
  });

  it("rejects a tampered payload even with a valid-looking signature", () => {
    const ticket = mintWhiteboardTicket(payload, { secret: SECRET });
    const [payloadB64, sig] = ticket.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, role: "student" }),
    ).toString("base64url");
    expect(
      verifyWhiteboardTicket(`${tamperedPayload}.${sig}`, SECRET, "lesson_1"),
    ).toBeNull();
    void payloadB64;
  });

  it("rejects an expired ticket", () => {
    const ticket = mintWhiteboardTicket(payload, {
      secret: SECRET,
      ttlSeconds: -10,
    });
    expect(verifyWhiteboardTicket(ticket, SECRET, "lesson_1")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(
      verifyWhiteboardTicket("not-a-ticket", SECRET, "lesson_1"),
    ).toBeNull();
    expect(verifyWhiteboardTicket("", SECRET, "lesson_1")).toBeNull();
  });
});
