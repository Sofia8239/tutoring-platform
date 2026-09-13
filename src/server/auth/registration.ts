import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole } from "@/generated/prisma/enums";

/**
 * Self-serve teacher signup. Each teacher is an independent tenant: their
 * `tenantId` is set to their own id right after creation, and every domain query
 * elsewhere filters by that id. Students never register here — a teacher invites
 * them into their own tenant with an invitation link.
 */

export type RegisterResult = { userId: string } | { error: string };

export async function registerTeacher(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { error: "Обліковий запис із цим email вже існує." };
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        role: UserRole.TEACHER,
        passwordHash,
        emailVerified: new Date(),
      },
      select: { id: true },
    });
    // A teacher IS their own tenant.
    await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: user.id },
    });
    return { userId: user.id };
  } catch {
    // Unique-constraint race on email.
    return { error: "Обліковий запис із цим email вже існує." };
  }
}
