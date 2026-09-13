import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { generateToken, hashToken } from "@/lib/tokens";
import { InvitationStatus, UserRole } from "@/generated/prisma/enums";
import {
  invitationExpiresAt,
  isInvitationUsable,
} from "@/server/auth/invitation-rules";

export { isInvitationUsable } from "@/server/auth/invitation-rules";

class InvitationError extends Error {}

export type UsableInvitation = {
  id: string;
  email: string;
  role: UserRole;
  teacherId: string;
};

/**
 * Issue an invitation. Returns the raw token exactly once (for the link); only
 * its hash is persisted. Any earlier pending invite for the same email in this
 * tenant is revoked so a given address has at most one live invitation.
 */
export async function createInvitation(input: {
  teacherId: string;
  createdById: string;
  email: string;
  role?: UserRole;
}): Promise<{ invitationId: string; rawToken: string; expiresAt: Date }> {
  const email = input.email.trim().toLowerCase();
  const rawToken = generateToken();
  const expiresAt = invitationExpiresAt();

  const [, invitation] = await prisma.$transaction([
    prisma.invitation.updateMany({
      where: {
        teacherId: input.teacherId,
        email,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    }),
    prisma.invitation.create({
      data: {
        teacherId: input.teacherId,
        createdById: input.createdById,
        email,
        role: input.role ?? UserRole.STUDENT,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    }),
  ]);

  return { invitationId: invitation.id, rawToken, expiresAt };
}

export async function getUsableInvitation(
  rawToken: string,
): Promise<UsableInvitation | null> {
  if (!rawToken) return null;

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!invitation || !isInvitationUsable(invitation)) return null;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    teacherId: invitation.teacherId,
  };
}

/**
 * Accept an invitation: create the user (scoped to the inviting teacher's
 * tenant) and mark the invitation consumed — atomically, re-checking the token
 * inside the transaction so a double submit can't create two users.
 */
export async function acceptInvitation(input: {
  rawToken: string;
  name: string;
  password: string;
}): Promise<{ userId: string } | { error: string }> {
  const tokenHash = hashToken(input.rawToken);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });
      if (!invitation || !isInvitationUsable(invitation)) {
        throw new InvitationError("Це запрошення недійсне або протерміноване.");
      }

      const existing = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      // A "manual" student in the inviting teacher's own tenant is upgraded in
      // place, so their lesson / payment history carries over.
      if (
        existing &&
        !existing.isRegistered &&
        existing.role === invitation.role &&
        existing.tenantId === invitation.teacherId
      ) {
        const upgraded = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: input.name.trim(),
            passwordHash,
            isRegistered: true,
            emailVerified: new Date(),
          },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
            acceptedById: upgraded.id,
          },
        });
        return upgraded;
      }

      if (existing) {
        throw new InvitationError("Користувач із цим email вже існує.");
      }

      const created = await tx.user.create({
        data: {
          email: invitation.email,
          name: input.name.trim(),
          role: invitation.role,
          tenantId: invitation.teacherId,
          passwordHash,
          emailVerified: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: created.id,
        },
      });

      return created;
    });

    return { userId: user.id };
  } catch (error) {
    if (error instanceof InvitationError) return { error: error.message };
    throw error;
  }
}
