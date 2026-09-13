import type { ReactNode } from "react";

import { requireRole } from "@/lib/session";
import { UserRole } from "@/generated/prisma/enums";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(UserRole.TEACHER);
  return <>{children}</>;
}
