import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { displayEmail } from "@/lib/manual-student";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { InvitationStatus, UserRole } from "@/generated/prisma/enums";

import { InviteStudentForm } from "../invite-student-form";
import { AddManualStudentForm } from "../add-manual-student-form";

export const metadata: Metadata = { title: "Мої учні" };

export default async function TeacherStudentsPage() {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const [students, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: teacherId, role: UserRole.STUDENT },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, isRegistered: true },
    }),
    prisma.invitation.findMany({
      where: { teacherId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Мої учні" />

      <Card className="flex flex-col gap-4">
        <CardTitle>Додати учня</CardTitle>
        <InviteStudentForm />
        <div className="border-line border-t pt-4">
          <AddManualStudentForm />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Учні</CardTitle>
        {students.length === 0 ? (
          <EmptyState
            icon={<Icon name="users" className="size-5" />}
            title="Поки що немає учнів"
            description="Надішліть посилання-запрошення або додайте учня без облікового запису — лише для обліку."
          />
        ) : (
          <ul className="divide-line divide-y">
            {students.map((s) => {
              const email = displayEmail(s.email);
              return (
                <li key={s.id}>
                  <Link
                    href={`/teacher/students/${s.id}`}
                    className="hover:bg-surface-2 rounded-btn -mx-2 flex items-center justify-between gap-3 px-2 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{s.name ?? "—"}</span>
                      {!s.isRegistered ? (
                        <Badge tone="neutral">без кабінету</Badge>
                      ) : null}
                    </span>
                    <span className="text-muted shrink-0">{email || "—"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pendingInvites.length > 0 ? (
          <div className="border-line flex flex-col gap-1 border-t pt-3">
            <span className="text-muted text-xs font-medium">
              Активні запрошення
            </span>
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{inv.email}</span>
                <span className="text-muted">
                  до {inv.expiresAt.toLocaleDateString("uk-UA")}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
