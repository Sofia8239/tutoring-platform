import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import { formatInZone } from "@/lib/datetime";
import { getUserTimezone } from "@/server/users/users";
import { displayEmail } from "@/lib/manual-student";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  InvitationStatus,
  LessonStatus,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";

import { InviteStudentForm } from "./invite-student-form";
import { AddManualStudentForm } from "./add-manual-student-form";

export const metadata: Metadata = { title: "Кабінет викладача" };

export default async function TeacherHomePage() {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const [
    students,
    pendingInvites,
    upcomingCount,
    completedCount,
    revenue,
    outstanding,
    nextLessons,
    timezone,
  ] = await Promise.all([
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
    prisma.lesson.count({
      where: {
        teacherId,
        status: LessonStatus.SCHEDULED,
        scheduledStart: { gte: new Date() },
      },
    }),
    prisma.lesson.count({
      where: { teacherId, status: LessonStatus.COMPLETED },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { teacherId, status: PaymentStatus.PAID },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        teacherId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      },
    }),
    prisma.lesson.findMany({
      where: {
        teacherId,
        status: LessonStatus.SCHEDULED,
        scheduledStart: { gte: new Date() },
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        scheduledStart: true,
        student: { select: { name: true, email: true } },
      },
    }),
    getUserTimezone(user.id),
  ]);

  const firstName = (user.name ?? "").split(" ")[0] || "викладачу";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Привіт, ${firstName} 👋`}
        subtitle="Ось коротко про ваш робочий тиждень."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Учнів"
          value={String(students.length)}
          tint="lavender"
        />
        <StatTile
          label="Уроків попереду"
          value={String(upcomingCount)}
          tint="peach"
        />
        <StatTile
          label="Проведено"
          value={String(completedCount)}
          tint="mint"
        />
        <StatTile
          label="Отримано оплат"
          value={formatMoney(revenue._sum.amount ?? 0)}
          hint={
            (outstanding._sum.amount ?? 0) > 0
              ? `борг ${formatMoney(outstanding._sum.amount ?? 0)}`
              : undefined
          }
          tint="rose"
        />
      </section>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle>Найближчі уроки</CardTitle>
          <Link
            href="/teacher/lessons"
            className="text-muted hover:text-ink text-sm font-medium"
          >
            Усі →
          </Link>
        </div>
        {nextLessons.length === 0 ? (
          <p className="text-muted text-sm">Запланованих уроків немає.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {nextLessons.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/teacher/lessons/${l.id}`}
                  className="rounded-btn hover:bg-surface-2 -mx-2 flex items-center justify-between gap-3 px-2 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{l.subject}</span>
                    <span className="text-muted text-xs">
                      {l.student.name ?? l.student.email}
                    </span>
                  </span>
                  <span className="text-muted shrink-0 text-xs">
                    {formatInZone(l.scheduledStart, timezone)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
            icon={<Icon name="home" className="size-5" />}
            title="Поки що немає учнів"
            description="Надішліть посилання-запрошення або додайте учня без облікового запису — лише для обліку."
          />
        ) : (
          <ul className="divide-line divide-y">
            {students.map((s) => {
              const email = displayEmail(s.email);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.name ?? "—"}</span>
                    {!s.isRegistered ? (
                      <Badge tone="neutral">без кабінету</Badge>
                    ) : null}
                  </span>
                  <span className="text-muted shrink-0">{email || "—"}</span>
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
