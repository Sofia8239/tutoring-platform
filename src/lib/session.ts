import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/route-access";
import { UserRole } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  role: UserRole;
  tenantId: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Redirects to /login when unauthenticated. Use in Server Components / actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Authoritative role check for a route subtree. ADMIN passes everything.
 * A mismatched role is bounced to its own home rather than shown a 403.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role && user.role !== UserRole.ADMIN) {
    redirect(homePathForRole(user.role));
  }
  return user;
}
