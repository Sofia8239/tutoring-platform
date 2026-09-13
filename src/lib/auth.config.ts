import type { NextAuthConfig } from "next-auth";

import { UserRole } from "@/generated/prisma/enums";

/**
 * Edge-safe Auth.js config: session strategy, pages, and the token/session
 * callbacks that move `role` / `tenantId` around. No Prisma adapter, no
 * password hashing, no `providers` — those live in `src/lib/auth.ts` (Node
 * only). `proxy.ts` builds a lightweight `NextAuth(authConfig)` from this to
 * read the JWT without pulling the server-only code into the proxy bundle.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role ?? UserRole.STUDENT;
        token.tenantId = user.tenantId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
