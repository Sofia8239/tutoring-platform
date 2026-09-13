import { InvitationStatus } from "@/generated/prisma/enums";

/**
 * Pure invitation rules — no DB, no server-only imports — so they can be unit
 * tested directly and reused by both the server module and any edge check.
 */

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function invitationExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_MS);
}

export function isInvitationUsable(
  invitation: { status: InvitationStatus; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return (
    invitation.status === InvitationStatus.PENDING &&
    invitation.expiresAt.getTime() > now.getTime()
  );
}
