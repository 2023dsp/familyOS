import type { RecurrenceUnit } from "@prisma/client";
import { dateAtTimeInTz, getHouseholdHMInTz } from "./timezone";

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export type RecurrenceConfig = {
  interval: number;
  unit: RecurrenceUnit;
  daysOfWeek?: string[]; // weekly mode
  dayOfMonth?: number; // monthly anchor
  timezone?: string; // household tz; defaults to Europe/Rome to match seed
};

/**
 * Compute the next occurrence after `from`, anchored at the same wall-clock
 * time-of-day as `from` in the household timezone. If `from` was set at
 * midnight (the default for date-only chores) we default to 20:00 local.
 */
export function nextOccurrence(from: Date, cfg: RecurrenceConfig): Date {
  const tz = cfg.timezone ?? "Europe/Rome";
  const original = getHouseholdHMInTz(from, tz);
  // Date-only chores come in at 00:00 local — bump to a sensible default
  // evening reminder time so cron + UX line up.
  const hour = original.hour === 0 && original.minute === 0 ? 20 : original.hour;
  const minute = original.hour === 0 && original.minute === 0 ? 0 : original.minute;

  const interval = Math.max(1, cfg.interval || 1);

  if (cfg.unit === "day") {
    const next = addDaysInTz(from, interval, tz);
    return dateAtTimeInTz(next, hour, minute, tz);
  }

  if (cfg.unit === "week") {
    if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) {
      const targets = cfg.daysOfWeek
        .map((d) => DAY_INDEX[d.toLowerCase()])
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b);
      if (targets.length > 0) {
        for (let i = 1; i <= 7 * interval + 7; i++) {
          const probe = addDaysInTz(from, i, tz);
          const probeDow = dayOfWeekInTz(probe, tz);
          if (targets.includes(probeDow)) return dateAtTimeInTz(probe, hour, minute, tz);
        }
      }
    }
    const next = addDaysInTz(from, 7 * interval, tz);
    return dateAtTimeInTz(next, hour, minute, tz);
  }

  if (cfg.unit === "month") {
    const next = addMonthsInTz(from, interval, tz);
    if (cfg.dayOfMonth && cfg.dayOfMonth >= 1 && cfg.dayOfMonth <= 28) {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" });
      const parts = fmt.formatToParts(next);
      const y = Number(parts.find((p) => p.type === "year")?.value);
      const m = Number(parts.find((p) => p.type === "month")?.value);
      const fakeAnchor = new Date(Date.UTC(y, m - 1, cfg.dayOfMonth));
      return dateAtTimeInTz(fakeAnchor, hour, minute, tz);
    }
    return dateAtTimeInTz(next, hour, minute, tz);
  }

  return from;
}

function addDaysInTz(d: Date, days: number, _tz: string): Date {
  // Day arithmetic is unambiguous in UTC except across DST boundaries; we
  // re-anchor the wall clock via dateAtTimeInTz afterwards, so a raw shift
  // by 86400_000ms * days is safe enough.
  return new Date(d.getTime() + days * 86400_000);
}

function addMonthsInTz(d: Date, months: number, tz: string): Date {
  // Use Intl to read the local calendar month, advance, then return the first-of-month
  // instant at midnight UTC of an approximate day. dateAtTimeInTz in caller realigns.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const target = new Date(Date.UTC(y, m - 1 + months, day));
  return target;
}

function dayOfWeekInTz(d: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
  const name = fmt.format(d).slice(0, 3).toLowerCase();
  const lookup: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  };
  return lookup[name] ?? 0;
}

export function formatRecurrence(cfg: RecurrenceConfig): string {
  const interval = Math.max(1, cfg.interval || 1);
  const unitLabel = (n: number, unit: RecurrenceUnit) => {
    const map: Record<RecurrenceUnit, [string, string]> = {
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"]
    };
    return n === 1 ? map[unit][0] : map[unit][1];
  };

  if (cfg.unit === "day" && interval === 1) return "Daily";
  if (cfg.unit === "week" && interval === 1) {
    if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) {
      const labels = cfg.daysOfWeek
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase())
        .join(", ");
      return `Weekly · ${labels}`;
    }
    return "Weekly";
  }
  if (cfg.unit === "month" && interval === 1) {
    return cfg.dayOfMonth ? `Monthly · ${cfg.dayOfMonth}th` : "Monthly";
  }
  return `Every ${interval} ${unitLabel(interval, cfg.unit)}`;
}
