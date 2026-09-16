import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import { getTeacherStats } from "@/server/stats/stats";
import type { PeriodKind } from "@/lib/stats-period";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeltaBadge } from "@/components/stats/delta-badge";
import {
  ErrorTypesChart,
  LessonsMonthlyTrendChart,
  LessonsPerDayChart,
  RevenueMonthlyTrendChart,
  RevenuePerDayChart,
} from "@/components/stats/stats-charts";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Статистика" };

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Тиждень" },
  { kind: "month", label: "Місяць" },
  { kind: "quarter", label: "Квартал" },
  { kind: "year", label: "Рік" },
  { kind: "custom", label: "Довільний період" },
];

function isPeriodKind(value: string | undefined): value is PeriodKind {
  return PERIODS.some((p) => p.kind === value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TeacherStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { period, from: fromParam, to: toParam } = await searchParams;

  const kind: PeriodKind = isPeriodKind(period) ? period : "month";
  const now = new Date();

  const customFrom = parseDateParam(fromParam);
  const customTo = parseDateParam(toParam);
  const custom =
    kind !== "custom"
      ? undefined
      : customFrom && customTo
        ? { from: customFrom, to: customTo }
        : { from: new Date(now.getTime() - 29 * DAY_MS), to: now };

  const stats = await getTeacherStats(teacherId, kind, now, custom);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Статистика"
        subtitle={`Період: ${stats.period.from} — ${stats.period.to} · попередній: ${stats.previousPeriod.from} — ${stats.previousPeriod.to}`}
        actions={
          <nav className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <Link
                key={p.kind}
                href={`/teacher/stats?period=${p.kind}`}
                className={`rounded-btn border px-3 py-1.5 text-sm font-medium ${
                  p.kind === kind
                    ? "border-primary bg-primary text-primary-ink"
                    : "border-line text-muted hover:bg-surface-2"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        }
      />

      {kind === "custom" ? (
        <form
          action="/teacher/stats"
          method="GET"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="period" value="custom" />
          <label className="text-muted flex flex-col gap-1 text-xs">
            Від
            <input
              type="date"
              name="from"
              defaultValue={stats.period.from}
              className="rounded-btn border-line border px-2 py-1 text-sm text-inherit"
            />
          </label>
          <label className="text-muted flex flex-col gap-1 text-xs">
            До
            <input
              type="date"
              name="to"
              defaultValue={stats.period.to}
              className="rounded-btn border-line border px-2 py-1 text-sm text-inherit"
            />
          </label>
          <button
            type="submit"
            className="rounded-btn border-primary bg-primary text-primary-ink border px-3 py-1.5 text-sm font-medium"
          >
            Застосувати
          </button>
        </form>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Минуле (факт)
          </h2>
          <Badge tone="success">факт</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Проведено"
            value={String(stats.current.lessons.completed)}
            tint="mint"
            hint={<DeltaBadge percent={stats.deltas.lessonsCompleted.percent} />}
          />
          <StatTile
            label="Заплановано (в періоді)"
            value={String(stats.current.lessons.scheduled)}
          />
          <StatTile
            label="Скасовано"
            value={String(stats.current.lessons.cancelled)}
          />
          <StatTile
            label="Не зʼявився"
            value={String(stats.current.lessons.noShow)}
          />
          <StatTile
            label="Отримано"
            value={formatMoney(stats.current.revenue, stats.currency)}
            tint="rose"
            hint={<DeltaBadge percent={stats.deltas.revenue.percent} />}
          />
          <StatTile
            label="Борг на кінець періоду"
            value={formatMoney(stats.current.outstanding, stats.currency)}
            tint={stats.current.outstanding > 0 ? "peach" : "plain"}
          />
          <StatTile
            label="Нових учнів"
            value={String(stats.current.students.newInRange)}
            tint="lavender"
            hint={<DeltaBadge percent={stats.deltas.newStudents.percent} />}
          />
          <StatTile
            label="Активних учнів"
            value={`${stats.current.students.activeInRange} / ${stats.current.students.total}`}
            hint={<DeltaBadge percent={stats.deltas.activeStudents.percent} />}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Попереду</h2>
          <Badge tone="attention">заплановано / очікується</Badge>
        </div>
        <p className="text-muted text-sm">
          {stats.upcoming.range.from} — {stats.upcoming.range.to}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Уроків заплановано"
            value={String(stats.upcoming.lessonsPlanned)}
            tint="lavender"
          />
          <StatTile
            label="Очікуваний дохід"
            value={formatMoney(stats.upcoming.expectedRevenue, stats.currency)}
            tint="peach"
          />
        </div>
      </section>

      <Card className="flex flex-col gap-3">
        <CardTitle>Проведені уроки за день</CardTitle>
        {stats.lessonsPerDay.every((p) => p.value === 0) ? (
          <EmptyState title="Немає проведених уроків за цей період" />
        ) : (
          <LessonsPerDayChart data={stats.lessonsPerDay} />
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Виручка за день ({stats.currency})</CardTitle>
        {stats.revenuePerDay.every((p) => p.value === 0) ? (
          <EmptyState
            title="Ще немає отриманих платежів за цей період"
            description="Дані зʼявляться автоматично, щойно надійдуть оплати."
          />
        ) : (
          <RevenuePerDayChart data={stats.revenuePerDay} currency={stats.currency} />
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Динаміка за весь час
        </h2>
        <p className="text-muted text-sm">
          Суцільна лінія — факт (минуле). Пунктирна — заплановано (майбутнє,
          вже в розкладі, ще не прогноз).
        </p>

        <Card className="flex flex-col gap-3">
          <CardTitle>Уроки по місяцях</CardTitle>
          {stats.monthlyTrend.length === 0 ? (
            <EmptyState
              title="Ще немає даних для графіка"
              description="Помісячна статистика зʼявиться після першого нічного перерахунку (pnpm worker) або pnpm stats:backfill."
            />
          ) : (
            <LessonsMonthlyTrendChart data={stats.monthlyTrend} />
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Виручка по місяцях ({stats.currency})</CardTitle>
          {stats.monthlyTrend.length === 0 ? (
            <EmptyState title="Ще немає даних для графіка" />
          ) : (
            <RevenueMonthlyTrendChart
              data={stats.monthlyTrend}
              currency={stats.currency}
            />
          )}
        </Card>
      </section>

      <Card className="flex flex-col gap-3">
        <CardTitle>Типові помилки (AI-перевірки)</CardTitle>
        {stats.errorTypes.length === 0 ? (
          <EmptyState title="Ще немає даних перевірок за цей період" />
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
