import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import { getTeacherStats } from "@/server/stats/stats";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import {
  ErrorTypesChart,
  LessonsPerDayChart,
  RevenuePerDayChart,
} from "@/components/stats/stats-charts";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Статистика" };

const RANGES = [
  { days: 7, label: "7 днів" },
  { days: 30, label: "30 днів" },
  { days: 90, label: "90 днів" },
];

export default async function TeacherStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { days: daysParam } = await searchParams;

  const days = RANGES.some((r) => String(r.days) === daysParam)
    ? Number(daysParam)
    : 30;
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  const stats = await getTeacherStats(teacherId, { from, to });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Статистика"
        subtitle={`Період: ${stats.range.from} — ${stats.range.to}`}
        actions={
          <nav className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r.days}
                href={`/teacher/stats?days=${r.days}`}
                className={`rounded-btn border px-3 py-1.5 text-sm font-medium ${
                  r.days === days
                    ? "border-primary bg-primary text-primary-ink"
                    : "border-line text-muted hover:bg-surface-2"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Проведено"
          value={String(stats.lessons.completed)}
          tint="mint"
        />
        <StatTile label="Заплановано" value={String(stats.lessons.scheduled)} />
        <StatTile label="Скасовано" value={String(stats.lessons.cancelled)} />
        <StatTile label="Не зʼявився" value={String(stats.lessons.noShow)} />
        <StatTile
          label="Виручка"
          value={formatMoney(stats.revenue, stats.currency)}
          tint="rose"
        />
        <StatTile
          label="Борг"
          value={formatMoney(stats.outstanding, stats.currency)}
          tint={stats.outstanding > 0 ? "peach" : "plain"}
        />
        <StatTile
          label="Нових учнів"
          value={String(stats.students.newInRange)}
          tint="lavender"
        />
        <StatTile
          label="Активних учнів"
          value={`${stats.students.activeInRange} / ${stats.students.total}`}
        />
      </section>

      <Card className="flex flex-col gap-3">
        <CardTitle>Проведені уроки за день</CardTitle>
        <LessonsPerDayChart data={stats.lessonsPerDay} />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Виручка за день ({stats.currency})</CardTitle>
        <RevenuePerDayChart
          data={stats.revenuePerDay}
          currency={stats.currency}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Типові помилки (AI-перевірки)</CardTitle>
        {stats.errorTypes.length === 0 ? (
          <p className="text-muted text-sm">Ще немає даних перевірок.</p>
        ) : (
          <>
            <ErrorTypesChart data={stats.errorTypes} />
            <table className="w-full text-sm">
              <tbody>
                {stats.errorTypes.map((e) => (
                  <tr
                    key={e.type}
                    className="border-line border-b last:border-0"
                  >
                    <td className="py-1.5">{e.type}</td>
                    <td className="text-muted py-1.5 text-right">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
