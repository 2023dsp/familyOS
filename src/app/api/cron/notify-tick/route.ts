import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToHousehold } from "../../../../lib/push";
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

async function digestFor(
  householdId: string,
  kind: "tomorrow" | "today" | "weekly"
): Promise<Record<string, unknown>> {
  const now = new Date();
  const today = startOfDay(now);

  if (kind === "tomorrow") {
    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = endOfDay(tomorrowStart);
    const [tomorrow, overdue] = await Promise.all([
      prisma.chore.findMany({
        where: { householdId, status: "active", dueDate: { gte: tomorrowStart, lte: tomorrowEnd } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        select: { title: true }
      }),
      prisma.chore.findMany({
        where: { householdId, status: "active", dueDate: { lt: today } },
        orderBy: { dueDate: "asc" },
        select: { title: true }
      })
    ]);
    if (tomorrow.length === 0 && overdue.length === 0) return { skipped: "empty" };
    const title =
      overdue.length > 0
        ? `FamilyOS · ${tomorrow.length} tomorrow · ${overdue.length} late`
        : `FamilyOS · ${tomorrow.length} chore${tomorrow.length === 1 ? "" : "s"} tomorrow`;
    const body = [
      tomorrow.slice(0, 3).map((c) => c.title).join(" · "),
      overdue.length > 0 ? `⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : ""
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 300);
    const result = await sendToHousehold(householdId, { title, body, url: "/", tag: "familyos-daily" });
    return { ...result, kind, tomorrow: tomorrow.length, overdue: overdue.length };
  }

  if (kind === "today") {
    const te = endOfDay(now);
    const [todays, overdue] = await Promise.all([
      prisma.chore.findMany({
        where: { householdId, status: "active", dueDate: { gte: today, lte: te } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        select: { title: true }
      }),
      prisma.chore.findMany({
        where: { householdId, status: "active", dueDate: { lt: today } },
        orderBy: { dueDate: "asc" },
        select: { title: true }
      })
    ]);
    if (todays.length === 0 && overdue.length === 0) return { skipped: "empty" };
    const title =
      overdue.length > 0
        ? `FamilyOS · ${todays.length} today · ${overdue.length} late`
        : `FamilyOS · ${todays.length} chore${todays.length === 1 ? "" : "s"} today`;
    const body = [
      todays.slice(0, 3).map((c) => c.title).join(" · "),
      overdue.length > 0 ? `⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : ""
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 300);
    const result = await sendToHousehold(householdId, { title, body, url: "/", tag: "familyos-daily" });
    return { ...result, kind, today: todays.length, overdue: overdue.length };
  }

  // weekly
  const start = new Date(today);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  const [nextWeek, overdue, important] = await Promise.all([
    prisma.chore.findMany({
      where: { householdId, status: "active", dueDate: { gte: start, lte: end } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      select: { title: true }
    }),
    prisma.chore.findMany({
      where: { householdId, status: "active", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      select: { title: true }
    }),
    prisma.chore.count({ where: { householdId, important: true, status: "active" } })
  ]);
  if (nextWeek.length === 0 && overdue.length === 0 && important === 0) return { skipped: "empty" };
  const title = `FamilyOS · ${nextWeek.length} next week${overdue.length > 0 ? ` · ${overdue.length} late` : ""}`;
  const body = (
    `${nextWeek.slice(0, 3).map((c) => c.title).join(" · ")}` +
    (overdue.length > 0 ? ` ⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "") +
    (important > 0 ? ` ★ ${important} pinned` : "")
  ).slice(0, 300);
  const result = await sendToHousehold(householdId, { title, body, url: "/", tag: "familyos-weekly" });
  return { ...result, kind, nextWeek: nextWeek.length, overdue: overdue.length, important };
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

  const households = await prisma.household.findMany({ select: { id: true } });

  // Daily
  if (
    schedule.daily.enabled &&
    last.daily !== now.isoDay &&
    withinWindow(now.hour, now.minute, schedule.daily.hour, schedule.daily.minute)
  ) {
    const kind = schedule.daily.when === "evening-before" ? "tomorrow" : "today";
    const perHousehold: Record<string, unknown>[] = [];
    for (const h of households) {
      try {
        perHousehold.push({ householdId: h.id, ...(await digestFor(h.id, kind)) });
      } catch (e) {
        perHousehold.push({ householdId: h.id, error: (e as Error).message });
      }
    }
    out.daily = perHousehold;
    await markFired("daily", now.isoDay);
  }

  // Weekly
  if (
    schedule.weekly.enabled &&
    now.dow === schedule.weekly.dow &&
    last.weekly !== now.isoDay &&
    withinWindow(now.hour, now.minute, schedule.weekly.hour, schedule.weekly.minute)
  ) {
    const perHousehold: Record<string, unknown>[] = [];
    for (const h of households) {
      try {
        perHousehold.push({ householdId: h.id, ...(await digestFor(h.id, "weekly")) });
      } catch (e) {
        perHousehold.push({ householdId: h.id, error: (e as Error).message });
      }
    }
    out.weekly = perHousehold;
    await markFired("weekly", now.isoDay);
  }

  return NextResponse.json({ ok: true, ...out });
}

export const GET = handler;
export const POST = handler;
