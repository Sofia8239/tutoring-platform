"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/money";
import type { DailyPoint } from "@/lib/stats-buckets";

// Indigo + Mint palette: a single indigo hue for magnitude, a recessive
// gray grid, muted ticks. Single-series -> no legend (per dataviz).
const HUE = "#4f46e5";
const GRID = "rgba(17,24,39,0.06)";
const TICK = "#4b5563";

const axis = { stroke: GRID, tick: { fill: TICK, fontSize: 11 } };

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
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
