import type { WhiteboardRole } from "@/server/whiteboard-sync/ticket";

/**
 * The one decision that gates who can edit a lesson's shared whiteboard: the
 * teacher always can; the student can only when the teacher has left editing
 * on. Pulled out as pure, unit-testable logic because this is the actual
 * security boundary — the sync server (src/jobs/whiteboard-sync-server.ts)
 * feeds its result straight into `TLSocketRoom.handleSocketConnect`'s
 * `isReadonly`, which is enforced independently of anything the client does
 * (a tampered client can't talk itself into write access).
 */
export function resolveIsReadonly(
  role: WhiteboardRole,
  studentCanEdit: boolean,
): boolean {
  if (role === "teacher") return false;
  return !studentCanEdit;
}
