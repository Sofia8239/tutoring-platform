"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  initialScrollHour,
  layoutDayLessons,
  weekDaysISO,
  zonedDayAndMinutes,
  type CalendarLesson,
} from "@/lib/calendar";

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const GUTTER = "3.25rem";
// The grid always spans the full day — `initialScrollHour` picks where it
// opens scrolled to, so a mostly-empty midnight-to-6am band isn't the first
// thing anyone sees.
const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;

const BLOCK_TONE: Record<string, string> = {
  SCHEDULED: "border-primary bg-primary-soft text-primary",
  COMPLETED: "border-success bg-success-soft text-success-strong",
  CANCELLED:
    "border-danger bg-danger-soft text-danger-strong line-through opacity-70",
  NO_SHOW: "border-attention bg-attention-soft text-attention-strong",
};

const WEEKDAY = new Intl.DateTimeFormat("uk-UA", { weekday: "short" });
const DAYNUM = new Intl.DateTimeFormat("uk-UA", { day: "numeric" });

function labelForDay(dateISO: string): { weekday: string; day: string } {
  const d = new Date(`${dateISO}T12:00:00Z`);
  return { weekday: WEEKDAY.format(d), day: DAYNUM.format(d) };
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function LessonWeekCalendar({
  lessons,
  timezone,
  weekStartISO,
  lessonBasePath,
  newLessonPath,
}: {
  lessons: CalendarLesson[];
  timezone: string;
  weekStartISO: string;
  lessonBasePath: string;
  newLessonPath: string;
}) {
  const days = useMemo(() => weekDaysISO(weekStartISO), [weekStartISO]);

  // Split lessons into day columns, converting each instant to the teacher's
  // wall-clock minutes.
  const byDay = useMemo(() => {
    const map = new Map<
      string,
      Array<CalendarLesson & { startMin: number; endMin: number }>
    >();
    for (const iso of days) map.set(iso, []);
    for (const l of lessons) {
      const start = zonedDayAndMinutes(new Date(l.startISO), timezone);
      const end = zonedDayAndMinutes(new Date(l.endISO), timezone);
      const bucket = map.get(start.dateISO);
      if (!bucket) continue;
      const endMin = end.dateISO === start.dateISO ? end.minutes : 24 * 60; // clamp to midnight
      bucket.push({ ...l, startMin: start.minutes, endMin });
    }
    return map;
  }, [lessons, days, timezone]);

  const allMinutes = useMemo(() => [...byDay.values()].flat(), [byDay]);

  const hours = useMemo(
    () =>
      Array.from(
        { length: GRID_END_HOUR - GRID_START_HOUR },
        (_, i) => GRID_START_HOUR + i,
      ),
    [],
  );
  const bodyHeight = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

  // Live "now" marker in the teacher's timezone, refreshed each minute.
  const [now, setNow] = useState(() =>
    zonedDayAndMinutes(new Date(), timezone),
  );
  useEffect(() => {
    const t = setInterval(
      () => setNow(zonedDayAndMinutes(new Date(), timezone)),
      60_000,
    );
    return () => clearInterval(t);
  }, [timezone]);

  // Full 00:00-24:00 grid opens scrolled to something relevant instead of
  // midnight: the earliest lesson of the week, or around "now" if today's in
  // view, falling back to mid-morning. Only on first mount per week.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const nowMinutes = days.includes(now.dateISO) ? now.minutes : null;
    const hour = initialScrollHour(allMinutes, nowMinutes);
    scrollRef.current?.scrollTo({ top: hour * HOUR_PX });
    // Intentionally only re-run when the visible week changes, not on every
    // "now" tick or lesson refetch — this is an opening position, not a
    // constant scroll-hijack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  const cols = `${GUTTER} repeat(7, minmax(6.5rem, 1fr))`;

  return (
    <div
      ref={scrollRef}
      className="border-line bg-surface shadow-soft rounded-card max-h-[70vh] overflow-auto border"
    >
      <div className="min-w-[52rem]">
        {/* Day headers */}
        <div
          className="border-line bg-surface sticky top-0 z-20 grid border-b"
          style={{ gridTemplateColumns: cols }}
        >
          <div />
          {days.map((iso) => {
            const { weekday, day } = labelForDay(iso);
            const isToday = iso === now.dateISO;
            return (
              <div
                key={iso}
                className="border-line flex flex-col items-center gap-0.5 border-l py-2"
              >
                <span className="text-muted text-[11px] tracking-wide uppercase">
                  {weekday}
                </span>
                <span
                  className={`grid size-7 place-items-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-primary text-primary-ink" : "text-ink"
                  }`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: cols, height: bodyHeight }}
        >
          {/* Hour gutter */}
          <div className="relative">
            {hours.map((h, i) => (
              <span
                key={h}
                className="text-muted absolute right-1.5 -translate-y-1/2 text-[11px]"
                style={{ top: i * HOUR_PX }}
              >
                {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {days.map((iso) => {
            const placed = layoutDayLessons(byDay.get(iso) ?? []);
            const showNow = iso === now.dateISO;
            return (
              <div key={iso} className="border-line relative border-l">
                {/* Hour lines + click-to-create slots */}
                {hours.map((h, i) => (
                  <Link
                    key={h}
                    href={`${newLessonPath}?start=${iso}T${String(h).padStart(2, "0")}:00`}
                    className="hover:bg-primary-soft/40 border-line/70 absolute inset-x-0 border-t transition-colors"
                    style={{ top: i * HOUR_PX, height: HOUR_PX }}
                    aria-label={`Новий урок ${iso} ${h}:00`}
                  />
                ))}

                {/* Lesson blocks */}
                {placed.map((l) => {
                  const top = (l.startMin - GRID_START_HOUR * 60) * PX_PER_MIN;
                  const height = Math.max(
                    (l.endMin - l.startMin) * PX_PER_MIN - 2,
                    16,
                  );
                  const widthPct = 100 / l.laneCount;
                  const compact = height < 34;
                  return (
                    <Link
                      key={l.id}
                      href={`${lessonBasePath}/${l.id}`}
                      className={`absolute overflow-hidden rounded-[0.5rem] border-l-2 px-1.5 py-1 text-[11px] leading-tight ${
                        BLOCK_TONE[l.status] ?? BLOCK_TONE.SCHEDULED
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${l.lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-semibold">
                        {l.subject}
                      </span>
                      {!compact ? (
                        <span className="text-ink/70 block truncate">
                          {hhmm(l.startMin)} · {l.personName}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}

                {/* Now marker */}
                {showNow ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{
                      top: (now.minutes - GRID_START_HOUR * 60) * PX_PER_MIN,
                    }}
                  >
                    <span className="bg-danger -ml-1 size-2 rounded-full" />
                    <span className="bg-danger h-px flex-1" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
