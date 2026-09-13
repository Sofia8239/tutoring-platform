import "server-only";

import { prisma } from "@/lib/prisma";
import { placeholderEmail } from "@/lib/manual-student";
import { UserRole } from "@/generated/prisma/enums";

/** Thrown for user-fixable problems when adding a student. */
export class StudentError extends Error {}

/** IANA timezone the user schedules and reads times in. Falls back to Kyiv. */
export async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return user?.timezone || "Europe/Kyiv";
}

export type TeacherProfile = {
  timezone: string;
  defaultMeetingUrl: string | null;
};

/** Per-teacher settings needed to schedule lessons. */
export async function getTeacherProfile(
  teacherId: string,
): Promise<TeacherProfile> {
  const user = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { timezone: true, defaultMeetingUrl: true },
  });
  return {
    timezone: user?.timezone || "Europe/Kyiv",
    defaultMeetingUrl: user?.defaultMeetingUrl ?? null,
  };
}

/** Set (or clear, with `null`) the teacher's permanent meeting-room link. */
export async function setDefaultMeetingUrl(
  teacherId: string,
  url: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: teacherId },
    data: { defaultMeetingUrl: url },
  });
}

export type TenantStudent = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  isRegistered: boolean;
};

/** Active + inactive students in a teacher's tenant, newest first. */
export async function listTenantStudents(
  teacherId: string,
): Promise<TenantStudent[]> {
  return prisma.user.findMany({
    where: { tenantId: teacherId, role: UserRole.STUDENT },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      isRegistered: true,
    },
  });
}

/**
 * Add a student the teacher only tracks for bookkeeping — no invitation, no
 * login. They can be scheduled and priced like any other student; they just
 * never get an account (unless later invited, which upgrades this same row).
 */
export async function createManualStudent(
  teacherId: string,
  input: { name: string; email?: string | null },
): Promise<{ id: string }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new StudentError("Вкажіть імʼя учня (2–120 символів).");
  }

  const rawEmail = input.email?.trim().toLowerCase() || "";
  if (rawEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      throw new StudentError("Некоректний email.");
    }
    const clash = await prisma.user.findUnique({
      where: { email: rawEmail },
      select: { id: true },
    });
    if (clash) {
      throw new StudentError("Користувач із цим email вже існує.");
    }
  }

  const created = await prisma.user.create({
    data: {
      role: UserRole.STUDENT,
      tenantId: teacherId,
      name,
      email: rawEmail || placeholderEmail(),
      isRegistered: false,
    },
    select: { id: true },
  });
  return created;
}
