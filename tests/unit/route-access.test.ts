import { describe, expect, it } from "vitest";

import {
  canAccess,
  homePathForRole,
  isAuthPage,
  isPublicPath,
  requiredRoleForPath,
} from "@/lib/route-access";
import { UserRole } from "@/generated/prisma/enums";

describe("isPublicPath", () => {
  it("allows the marketing root and the auth entry points", () => {
    for (const p of [
      "/",
      "/login",
      "/register",
      "/join/abc",
      "/api/auth/session",
      "/api/health",
    ]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("guards every tenant-scoped area", () => {
    for (const p of [
      "/teacher",
      "/teacher/lessons",
      "/student",
      "/student/lessons/x",
      "/dashboard",
      "/teacher/pages/p1",
    ]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("does not treat a lookalike prefix as public", () => {
    expect(isPublicPath("/registerx")).toBe(false);
    expect(isPublicPath("/loginhack")).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("is true for login, register and join", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/join/tok")).toBe(true);
    expect(isAuthPage("/teacher")).toBe(false);
  });
});

describe("role routing", () => {
  it("maps roles to their home and gates by segment", () => {
    expect(homePathForRole(UserRole.TEACHER)).toBe("/teacher");
    expect(homePathForRole(UserRole.STUDENT)).toBe("/student");
    expect(requiredRoleForPath("/teacher/lessons")).toBe(UserRole.TEACHER);
    expect(requiredRoleForPath("/student/x")).toBe(UserRole.STUDENT);
    expect(requiredRoleForPath("/dashboard")).toBeNull();
  });

  it("keeps a student out of teacher space and vice versa", () => {
    expect(canAccess("/teacher/lessons", UserRole.STUDENT)).toBe(false);
    expect(canAccess("/student", UserRole.TEACHER)).toBe(false);
    expect(canAccess("/teacher", UserRole.ADMIN)).toBe(true);
  });
});
