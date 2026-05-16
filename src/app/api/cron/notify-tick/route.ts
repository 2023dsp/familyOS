import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToAll } from "../../../../lib/push";
import { getLastFired, getRomeNow, getSchedule, markFired } from "../../../../lib/notify-schedule";
import { startOfDay, endOfDay } from "../../../../lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MIN = 6; // catch up if cron skipped a minute

function withinWindow(curH: number, curM: number, tgtH: number, tgtM: number): boolean {
  const cur = curH * 60 + curM;
  const tgt = tgtH * 60 + tgtM;
  const diff = cur - tgt;
  return diff >= 0 && diff < WINDOW_MIN;
}

async function fireTomorrowDigest() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);

  const [tomorrow, overdue] = await Promise.all([
    prisma.chore.findMany({
      where: { status: "active", dueDate: { gte: tomorrowStart, lte: tomorrowEnd } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      select: { title: true }
    }),
    prisma.chore.findMany({
      where: { status: "active", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      select: { title: true }
    })
  ]);
  if (tomorrow.length === 0 && overdue.length === 0) return { skipped: "empty" };
  const title =
    overdue.length > 0
      ? `FamilyOS · ${tomorrow.length} tomorrow · ${overdue.length} late`
      : `FamilyOS · ${tomorrow.length} chore${tomorrow.length === 1 ? "" : "s"} tomorrow`;
  const tomorrowLine = tomorrow.slice(0, 3).map((c) => c.title).join(" · ");
  const overdueLine = overdue.length > 0 ? `⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
  const body = [tomorrowLine, overdueLine].filter(Boolean).join(" — ").slice(0, 300);
  const result = await sendToAll({ title, body, url: "/", tag: "familyos-daily" });
  return { ...result, kind: "tomorrow", tomorrow: tomorrow.length, overdue: overdue.length };
}

async function fireTodayDigest() {
  const now = new Date();
  const today = startOfDay(now);
  const te = endOfDay(now);
  const [todays, overdue] = await Promise.all([
    prisma.chore.findMany({
      where: { status: "active", dueDate: { gte: today, lte: te } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      select: { title: true }
    }),
    prisma.chore.findMany({
      where: { status: "active", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      select: { title: true }
    })
  ]);
  if (todays.length === 0 && overdue.length === 0) return { skipped: "empty" };
  const title =
    overdue.length > 0
      ? `FamilyOS · ${todays.length} today · ${overdue.length} late`
      : `FamilyOS · ${todays.length} chore${todays.length === 1 ? "" : "s"} today`;
  const todayLine = todays.slice(0, 3).map((c) => c.title).join(" · ");
  const overdueLine = overdue.length > 0 ? `⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
  const body = [todayLine, overdueLine].filter(Boolean).join(" — ").slice(0, 300);
  const result = await sendToAll({ title, body, url: "/", tag: "familyos-daily" });
  return { ...result, kind: "today", today: todays.length, overdue: overdue.length };
}

async function fireWeeklyDigest() {
  const now = new Date();
  const today = startOfDay(now);
  const start = new Date(today);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  const [nextWeek, overdue, important] = await Promise.all([
    prisma.chore.findMany({
      where: { status: "active", dueDate: { gte: start, lte: end } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      select: { title: true }
    }),
    prisma.chore.findMany({
      where: { status: "active", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      select: { title: true }
    }),
    prisma.chore.count({ where: { important: true, status: "active" } })
  ]);
  if (nextWeek.length === 0 && overdue.length === 0 && important === 0) return { skipped: "empty" };
  const title = `FamilyOS · ${nextWeek.length} next week${overdue.length > 0 ? ` · ${overdue.length} late` : ""}`;
  const top = nextWeek.slice(0, 3).map((c) => c.title).join(" · ");
  const overdueLine = overdue.length > 0 ? ` ⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
  const importantLine = important > 0 ? ` ★ ${important} pinned` : "";
  const body = `${top}${overdueLine}${importantLine}`.slice(0, 300);
  const result = await sendToAll({ title, body, url: "/", tag: "familyos-weekly" });
  return { ...result, kind: "weekly", nextWeek: nextWeek.length, overdue: overdue.length, important };
}

async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if ((req.headers.get("x-cron-secret") ?? "") !== secret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schedule = await getSchedule();
  const last = await getLastFired();
  const now = getRomeNow();
  const out: Record<string, unknown> = { now };

  // Daily
  if (
    schedule.daily.enabled &&
    last.daily !== now.isoDay &&
    withinWindow(now.hour, now.minute, schedule.daily.hour, schedule.daily.minute)
  ) {
    try {
      const r = schedule.daily.when === "evening-before" ? await fireTomorrowDigest() : await fireTodayDigest();
      out.daily = r;
      await markFired("daily", now.isoDay);
    } catch (e) {
      out.dailyError = (e as Error).message;
    }
  }

  // Weekly
  if (
    schedule.weekly.enabled &&
    now.dow === schedule.weekly.dow &&
    last.weekly !== now.isoDay &&
    withinWindow(now.hour, now.minute, schedule.weekly.hour, schedule.weekly.minute)
  ) {
    try {
      const r = await fireWeeklyDigest();
      out.weekly = r;
      await markFired("weekly", now.isoDay);
    } catch (e) {
      out.weeklyError = (e as Error).message;
    }
  }

  return NextResponse.json({ ok: true, ...out });
}

export const GET = handler;
export const POST = handler;
