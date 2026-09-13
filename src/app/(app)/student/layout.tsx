import type { ReactNode } from "react";

import { requireRole } from "@/lib/session";
import { UserRole } from "@/generated/prisma/enums";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(UserRole.STUDENT);
  return <>{children}</>;
}
