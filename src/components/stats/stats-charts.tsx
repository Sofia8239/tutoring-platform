"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/money";
import type { DailyPoint } from "@/lib/stats-buckets";
import type { MonthlyTrendPoint } from "@/server/stats/stats";

// Indigo + Mint palette: a single indigo hue for magnitude, a recessive
// gray grid, muted ticks. Single-series -> no legend (per dataviz).
const HUE = "#4f46e5";
const GRID = "rgba(17,24,39,0.06)";
const TICK = "#4b5563";

const axis = { stroke: GRID, tick: { fill: TICK, fontSize: 11 } };

// Same hue for the factual line/bars; the planned/future side reuses it but
// dashed, per dataviz convention for "not yet realized" data.
const PLANNED_DASH = "6 4";

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

const MONTH_NAMES = [
  "січ",
  "лют",
  "бер",
  "квіт",
  "трав",
  "черв",
  "лип",
  "серп",
  "вер",
  "жовт",
  "лист",
  "груд",
];

function shortMonth(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year.slice(2)}`;
}

/**
 * Bridges the actual→planned gap: the last actual point also carries the
 * planned series' value, so the dashed line visually continues from where
 * the solid line ends instead of starting mid-air at the first future month.
 * Purely a rendering nicety — doesn't change what `actualKey`/`plannedKey` mean.
 */
function bridgeActualToPlanned(
  data: MonthlyTrendPoint[],
  actualKey: "lessonsActual" | "revenueActual",
  plannedKey: "lessonsPlanned" | "revenuePlanned",
): MonthlyTrendPoint[] {
  const firstPlannedIndex = data.findIndex((p) => p[plannedKey] !== null);
  const boundaryIndex = firstPlannedIndex - 1;
  if (firstPlannedIndex <= 0 || data[boundaryIndex][actualKey] === null) {
    return data;
  }
  const bridged = [...data];
  bridged[boundaryIndex] = {
    ...bridged[boundaryIndex],
    [plannedKey]: bridged[boundaryIndex][actualKey],
  };
  return bridged;
}

export function LessonsPerDayChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip
          labelFormatter={(l) => `Дата: ${l}`}
          formatter={(v) => [Number(v), "Проведено"]}
        />
        <Bar dataKey="value" fill={HUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenuePerDayChart({
  data,
  currency,
}: {
  data: DailyPoint[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axis} />
        <YAxis
          tickFormatter={(v: number) => String(Math.round(v / 100))}
          {...axis}
        />
        <Tooltip
          labelFormatter={(l) => `Дата: ${l}`}
          formatter={(v) => [formatMoney(Number(v), currency), "Виручка"]}
        />
        <Bar dataKey="value" fill={HUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LessonsMonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const chartData = bridgeActualToPlanned(data, "lessonsActual", "lessonsPlanned");
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={shortMonth} {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip
          labelFormatter={(l) => shortMonth(String(l))}
          formatter={(v, name) => [
            v == null ? "—" : Number(v),
            name === "lessonsActual" ? "Проведено" : "Заплановано",
          ]}
        />
        <Line
          type="monotone"
          dataKey="lessonsActual"
          stroke={HUE}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="lessonsPlanned"
          stroke={HUE}
          strokeWidth={2}
          strokeDasharray={PLANNED_DASH}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RevenueMonthlyTrendChart({
  data,
  currency,
}: {
  data: MonthlyTrendPoint[];
  currency: string;
}) {
  const chartData = bridgeActualToPlanned(data, "revenueActual", "revenuePlanned");
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={shortMonth} {...axis} />
        <YAxis tickFormatter={(v: number) => String(Math.round(v / 100))} {...axis} />
        <Tooltip
          labelFormatter={(l) => shortMonth(String(l))}
          formatter={(v, name) => [
            v == null ? "—" : formatMoney(Number(v), currency),
            name === "revenueActual" ? "Отримано" : "Очікується",
          ]}
        />
        <Line
          type="monotone"
          dataKey="revenueActual"
          stroke={HUE}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="revenuePlanned"
          stroke={HUE}
          strokeWidth={2}
          strokeDasharray={PLANNED_DASH}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ErrorTypesChart({
  data,
}: {
  data: { type: string; count: number }[];
}) {
  const top = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, top.length * 34)}>
      <BarChart
        data={top}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis
          type="category"
          dataKey="type"
          width={140}
          {...axis}
          tick={{ fill: TICK, fontSize: 11 }}
        />
        <Tooltip formatter={(v) => [Number(v), "Помилок"]} />
        <Bar dataKey="count" fill={HUE} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {top.map((_, i) => (
            <Cell key={i} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
