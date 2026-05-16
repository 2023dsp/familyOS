import type { RecurrenceUnit } from "@prisma/client";

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
};

export function nextOccurrence(from: Date, cfg: RecurrenceConfig): Date {
  const base = new Date(from);
  base.setHours(20, 0, 0, 0);
  const interval = Math.max(1, cfg.interval || 1);

  if (cfg.unit === "day") {
    base.setDate(base.getDate() + interval);
    return base;
  }

  if (cfg.unit === "week") {
    if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) {
      const targets = cfg.daysOfWeek
        .map((d) => DAY_INDEX[d.toLowerCase()])
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b);
      if (targets.length === 0) {
        base.setDate(base.getDate() + 7 * interval);
        return base;
      }
      for (let i = 1; i <= 7 * interval + 7; i++) {
        const probe = new Date(from);
        probe.setHours(20, 0, 0, 0);
        probe.setDate(probe.getDate() + i);
        if (targets.includes(probe.getDay())) return probe;
      }
    }
    base.setDate(base.getDate() + 7 * interval);
    return base;
  }

  if (cfg.unit === "month") {
    const next = new Date(base);
    next.setMonth(next.getMonth() + interval);
    if (cfg.dayOfMonth && cfg.dayOfMonth >= 1 && cfg.dayOfMonth <= 28) {
      next.setDate(cfg.dayOfMonth);
    }
    return next;
  }

  return base;
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
