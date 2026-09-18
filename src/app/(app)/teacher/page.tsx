import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import { formatInZone } from "@/lib/datetime";
import { getUserTimezone } from "@/server/users/users";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { LessonStatus, PaymentStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Кабінет викладача" };

export default async function TeacherHomePage() {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const [
    studentCount,
    upcomingCount,
    completedCount,
    revenue,
    outstanding,
    nextLessons,
    timezone,
  ] = await Promise.all([
    prisma.user.count({
      where: { tenantId: teacherId, role: UserRole.STUDENT },
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
        <Link href="/teacher/students" className="block transition-opacity hover:opacity-80">
          <StatTile label="Учнів" value={String(studentCount)} tint="lavender" />
        </Link>
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

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Учні</CardTitle>
          <Link
            href="/teacher/students"
            className="text-muted hover:text-ink text-sm font-medium"
          >
            Усі →
          </Link>
        </div>
        <p className="text-muted text-sm">
          Додати учня, переглянути кабінет кожного — на вкладці «Мої учні».
        </p>
      </Card>
    </div>
  );
}
