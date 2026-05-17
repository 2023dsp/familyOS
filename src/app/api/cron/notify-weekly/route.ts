import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToHousehold } from "../../../../lib/push";
import { startOfDay } from "../../../../lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if ((req.headers.get("x-cron-secret") ?? "") !== secret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = startOfDay(now);
  const start = new Date(today);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  const households = await prisma.household.findMany({ select: { id: true } });
  const out: Record<string, unknown>[] = [];

  for (const h of households) {
    const [nextWeek, overdue, important] = await Promise.all([
      prisma.chore.findMany({
        where: { householdId: h.id, status: "active", dueDate: { gte: start, lte: end } },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        select: { title: true, dueDate: true }
      }),
      prisma.chore.findMany({
        where: { householdId: h.id, status: "active", dueDate: { lt: today } },
        orderBy: { dueDate: "asc" },
        select: { title: true }
      }),
      prisma.chore.count({ where: { householdId: h.id, important: true, status: "active" } })
    ]);

    if (nextWeek.length === 0 && overdue.length === 0 && important === 0) {
      out.push({ householdId: h.id, skipped: "empty week" });
      continue;
    }

    const title = `FamilyOS · ${nextWeek.length} next week${overdue.length > 0 ? ` · ${overdue.length} late` : ""}`;
    const top = nextWeek.slice(0, 3).map((c) => c.title).join(" · ");
    const overdueLine = overdue.length > 0 ? ` ⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
    const importantLine = important > 0 ? ` ★ ${important} pinned` : "";
    const body = `${top}${overdueLine}${importantLine}`.slice(0, 300) || "Plan ready for next week.";

    try {
      const result = await sendToHousehold(h.id, { title, body, url: "/", tag: "familyos-weekly" });
      out.push({ householdId: h.id, ...result, nextWeek: nextWeek.length, overdue: overdue.length, important });
    } catch (e) {
      out.push({ householdId: h.id, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, households: out });
}

export const GET = handler;
export const POST = handler;
