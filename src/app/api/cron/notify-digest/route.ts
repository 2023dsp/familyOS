import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToHousehold } from "../../../../lib/push";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "../../../../lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!secret || got !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const ts = startOfDay(now);
  const te = endOfDay(now);
  const ws = startOfWeek(now);
  const we = endOfWeek(now);

  const households = await prisma.household.findMany({ select: { id: true } });
  const out: Record<string, unknown>[] = [];

  for (const h of households) {
    const [todayCount, weekActive, weekDone, important, samples] = await Promise.all([
      prisma.chore.count({ where: { householdId: h.id, status: "active", dueDate: { gte: ts, lte: te } } }),
      prisma.chore.count({ where: { householdId: h.id, status: "active", dueDate: { gte: ws, lte: we } } }),
      prisma.choreCompletion.count({
        where: { completedAt: { gte: ws, lte: we }, chore: { householdId: h.id } }
      }),
      prisma.chore.findMany({
        where: { householdId: h.id, important: true, status: "active" },
        take: 3,
        select: { title: true }
      }),
      prisma.chore.findMany({
        where: { householdId: h.id, status: "active", dueDate: { gte: ts, lte: we } },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        take: 3,
        select: { title: true }
      })
    ]);

    if (todayCount === 0 && weekActive === 0 && important.length === 0) {
      out.push({ householdId: h.id, skipped: "empty week" });
      continue;
    }

    const title = todayCount > 0
      ? `FamilyOS · ${todayCount} today · ${weekActive} this week`
      : `FamilyOS · ${weekActive} chores this week`;

    const sampleLine = samples.length > 0 ? samples.map((s) => s.title).join(" · ") : "Nothing scheduled.";
    const importantLine = important.length > 0 ? ` ★ ${important.map((i) => i.title).join(" · ")}` : "";
    const doneLine = weekDone > 0 ? ` · ${weekDone} already done` : "";

    try {
      const result = await sendToHousehold(h.id, {
        title,
        body: `${sampleLine}${doneLine}${importantLine}`.slice(0, 300),
        url: "/",
        tag: "familyos-weekly"
      });
      out.push({ householdId: h.id, ...result, todayCount, weekActive, weekDone });
    } catch (e) {
      out.push({ householdId: h.id, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, households: out });
}

export const GET = handler;
export const POST = handler;
