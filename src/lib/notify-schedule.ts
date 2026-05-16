import { prisma } from "./prisma";

export type DailyWhen = "evening-before" | "morning-of";

export type NotifySchedule = {
  daily: { enabled: boolean; when: DailyWhen; hour: number; minute: number };
  weekly: { enabled: boolean; dow: number; hour: number; minute: number };
};

export const DEFAULT_SCHEDULE: NotifySchedule = {
  daily: { enabled: true, when: "evening-before", hour: 20, minute: 30 },
  weekly: { enabled: true, dow: 0, hour: 20, minute: 30 } // Sunday
};

const KEYS = [
  "notify_daily_enabled",
  "notify_daily_when",
  "notify_daily_hour",
  "notify_daily_minute",
  "notify_weekly_enabled",
  "notify_weekly_dow",
  "notify_weekly_hour",
  "notify_weekly_minute",
  "notify_daily_last_fired_on",
  "notify_weekly_last_fired_on"
] as const;

async function readAll(): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: [...KEYS] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function write(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

export async function getSchedule(): Promise<NotifySchedule> {
  const m = await readAll();
  const num = (v: string | undefined, d: number) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) ? n : d;
  };
  return {
    daily: {
      enabled: (m.notify_daily_enabled ?? "1") !== "0",
      when: (m.notify_daily_when === "morning-of" ? "morning-of" : "evening-before") as DailyWhen,
      hour: num(m.notify_daily_hour, DEFAULT_SCHEDULE.daily.hour),
      minute: num(m.notify_daily_minute, DEFAULT_SCHEDULE.daily.minute)
    },
    weekly: {
      enabled: (m.notify_weekly_enabled ?? "1") !== "0",
      dow: num(m.notify_weekly_dow, DEFAULT_SCHEDULE.weekly.dow),
      hour: num(m.notify_weekly_hour, DEFAULT_SCHEDULE.weekly.hour),
      minute: num(m.notify_weekly_minute, DEFAULT_SCHEDULE.weekly.minute)
    }
  };
}

export async function saveSchedule(s: NotifySchedule): Promise<void> {
  await Promise.all([
    write("notify_daily_enabled", s.daily.enabled ? "1" : "0"),
    write("notify_daily_when", s.daily.when),
    write("notify_daily_hour", String(s.daily.hour)),
    write("notify_daily_minute", String(s.daily.minute)),
    write("notify_weekly_enabled", s.weekly.enabled ? "1" : "0"),
    write("notify_weekly_dow", String(s.weekly.dow)),
    write("notify_weekly_hour", String(s.weekly.hour)),
    write("notify_weekly_minute", String(s.weekly.minute))
  ]);
}

export async function getLastFired(): Promise<{ daily: string | null; weekly: string | null }> {
  const m = await readAll();
  return {
    daily: m.notify_daily_last_fired_on ?? null,
    weekly: m.notify_weekly_last_fired_on ?? null
  };
}

export async function markFired(kind: "daily" | "weekly", isoDay: string): Promise<void> {
  await write(kind === "daily" ? "notify_daily_last_fired_on" : "notify_weekly_last_fired_on", isoDay);
}

// Current Europe/Rome wall-clock time (using Intl, DST-aware).
export function getRomeNow(): { y: number; m: number; d: number; hour: number; minute: number; dow: number; isoDay: string } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false
  });
  const parts = f.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = weekdayMap[get("weekday").slice(0, 3)] ?? 0;
  const isoDay = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { y, m, d, hour, minute, dow, isoDay };
}
