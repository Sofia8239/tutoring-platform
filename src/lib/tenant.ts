import { UserRole } from "@/generated/prisma/enums";

type TenantScopedUser = {
  id: string;
  role: UserRole;
  tenantId: string | null;
};

/**
 * The tenant key every domain query must be scoped by (golden rule 7).
 *
 * While the product is single-tenant the owning teacher *is* the tenant:
 *  - TEACHER  -> their own id
 *  - STUDENT  -> their teacher's id (User.tenantId)
 *  - ADMIN    -> has no implicit tenant; callers must pass one explicitly
 *
 * Throws if the tenant cannot be resolved, so a missing scope fails loudly
 * instead of leaking across tenants.
 */
export function resolveTenantId(user: TenantScopedUser): string {
  if (user.role === UserRole.TEACHER) {
    return user.tenantId ?? user.id;
  }

  if (user.tenantId) {
    return user.tenantId;
  }

  throw new Error(
    `Cannot resolve tenant for user ${user.id} (role ${user.role})`,
  );
}

/** Non-throwing variant for places that must branch instead of erroring. */
export function tryResolveTenantId(user: TenantScopedUser): string | null {
  try {
    return resolveTenantId(user);
  } catch {
    return null;
  }
}
