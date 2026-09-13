import { UserRole } from "@/generated/prisma/enums";

/**
 * Pure route-access rules, shared by `proxy.ts` (optimistic redirects) and the
 * server layouts (authoritative checks). No Node/Next APIs so it is safe in the
 * edge/proxy bundle.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/join",
  "/api/auth",
  "/api/health",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/join")
  );
}

export function homePathForRole(role: UserRole): string {
  return role === UserRole.STUDENT ? "/student" : "/teacher";
}

/** The role a path segment requires, or null if any authenticated user may enter. */
export function requiredRoleForPath(pathname: string): UserRole | null {
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) {
    return UserRole.TEACHER;
  }
  if (pathname === "/student" || pathname.startsWith("/student/")) {
    return UserRole.STUDENT;
  }
  return null;
}

export function canAccess(pathname: string, role: UserRole): boolean {
  if (role === UserRole.ADMIN) return true;
  const needed = requiredRoleForPath(pathname);
  return needed === null || needed === role;
}
