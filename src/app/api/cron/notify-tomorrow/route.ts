import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToHousehold } from "../../../../lib/push";
import { startOfDay, endOfDay } from "../../../../lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if ((req.headers.get("x-cron-secret") ?? "") !== secret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = startOfDay(now);
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);

  const households = await prisma.household.findMany({ select: { id: true } });
  const out: Record<string, unknown>[] = [];

  for (const h of households) {
    const [tomorrow, overdue] = await Promise.all([
      prisma.chore.findMany({
        where: { householdId: h.id, status: "active", dueDate: { gte: tomorrowStart, lte: tomorrowEnd } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        select: { title: true, priority: true }
      }),
      prisma.chore.findMany({
        where: { householdId: h.id, status: "active", dueDate: { lt: today } },
        orderBy: { dueDate: "asc" },
        select: { title: true }
      })
    ]);

    if (tomorrow.length === 0 && overdue.length === 0) {
      out.push({ householdId: h.id, skipped: "empty" });
      continue;
    }

    const title =
      overdue.length > 0
        ? `FamilyOS · ${tomorrow.length} tomorrow · ${overdue.length} late`
        : `FamilyOS · ${tomorrow.length} chore${tomorrow.length === 1 ? "" : "s"} tomorrow`;
    const tomorrowLine = tomorrow.length > 0 ? tomorrow.slice(0, 3).map((c) => c.title).join(" · ") : "";
    const overdueLine = overdue.length > 0 ? `⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
    const body = [tomorrowLine, overdueLine].filter(Boolean).join(" — ").slice(0, 300) || "Tomorrow's plan ready.";

    try {
      const result = await sendToHousehold(h.id, { title, body, url: "/", tag: "familyos-tomorrow" });
      out.push({ householdId: h.id, ...result, tomorrow: tomorrow.length, overdue: overdue.length });
    } catch (e) {
      out.push({ householdId: h.id, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, households: out });
}

export const GET = handler;
export const POST = handler;
