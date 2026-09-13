import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/generated/prisma/enums";

/**
 * Module augmentation so `session.user.role` / `session.user.id` are typed
 * everywhere. The values are populated by the `jwt` and `session` callbacks in
 * `src/lib/auth.ts`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      tenantId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    tenantId: string | null;
  }
}

/**
 * `next-auth/jwt` only re-exports from `@auth/core/jwt`, so the `JWT` interface
 * has to be augmented at its source for declaration merging to take effect.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tenantId: string | null;
  }
}
