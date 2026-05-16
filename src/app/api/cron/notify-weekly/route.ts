import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToAll } from "../../../../lib/push";
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
  // "Next week" = the 7 days starting from tomorrow.
  const start = new Date(today);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  const [nextWeek, overdue, important] = await Promise.all([
    prisma.chore.findMany({
      where: { status: "active", dueDate: { gte: start, lte: end } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      select: { title: true, dueDate: true }
    }),
    prisma.chore.findMany({
      where: { status: "active", dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      select: { title: true }
    }),
    prisma.chore.count({ where: { important: true, status: "active" } })
  ]);

  if (nextWeek.length === 0 && overdue.length === 0 && important === 0) {
    return NextResponse.json({ ok: true, skipped: "empty week" });
  }

  const title = `FamilyOS · ${nextWeek.length} next week${overdue.length > 0 ? ` · ${overdue.length} late` : ""}`;
  const top = nextWeek.slice(0, 3).map((c) => c.title).join(" · ");
  const overdueLine = overdue.length > 0 ? ` ⚠ ${overdue.slice(0, 3).map((c) => c.title).join(" · ")}` : "";
  const importantLine = important > 0 ? ` ★ ${important} pinned` : "";
  const body = (`${top}${overdueLine}${importantLine}`).slice(0, 300) || "Plan ready for next week.";

  try {
    const result = await sendToAll({ title, body, url: "/", tag: "familyos-weekly" });
    return NextResponse.json({
      ok: true,
      ...result,
      nextWeek: nextWeek.length,
      overdue: overdue.length,
      important
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

export const GET = handler;
export const POST = handler;
