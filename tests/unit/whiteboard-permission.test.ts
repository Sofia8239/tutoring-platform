import { describe, expect, it } from "vitest";

import { resolveIsReadonly } from "@/lib/whiteboard-permission";

/**
 * This is the actual server-side enforcement for Part 2 of the shared
 * whiteboard: `whiteboard-sync-server.ts` feeds this straight into
 * `TLSocketRoom.handleSocketConnect`'s `isReadonly`, which the sync room
 * enforces independently of the client — a student whose local UI claims
 * "can edit" still can't push changes once their session was opened
 * read-only.
 */
describe("resolveIsReadonly", () => {
  it("the teacher can always edit, regardless of the toggle", () => {
    expect(resolveIsReadonly("teacher", true)).toBe(false);
    expect(resolveIsReadonly("teacher", false)).toBe(false);
  });

  it("the student can edit only when the teacher has left it on", () => {
    expect(resolveIsReadonly("student", true)).toBe(false);
    expect(resolveIsReadonly("student", false)).toBe(true);
  });
});
