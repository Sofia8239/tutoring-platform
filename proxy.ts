import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import {
  homePathForRole,
  isAuthPage,
  isPublicPath,
  requiredRoleForPath,
} from "@/lib/route-access";
import { UserRole } from "@/generated/prisma/enums";

// Next 16: "middleware" is now "proxy" and runs on the Node.js runtime.
// This is an *optimistic* guard (reads the signed JWT cookie, no DB). The
// server layouts under (app) do the authoritative check.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;
  const path = nextUrl.pathname;

  // Signed-in users never see the login / invite pages.
  if (user && isAuthPage(path)) {
    return NextResponse.redirect(new URL(homePathForRole(user.role), nextUrl));
  }

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  if (!user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${path}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const needed = requiredRoleForPath(path);
  if (needed && user.role !== needed && user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL(homePathForRole(user.role), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
