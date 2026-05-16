import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToAll } from "../../../../lib/push";
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

  const [todayCount, weekActive, weekDone, important, samples] = await Promise.all([
    prisma.chore.count({ where: { status: "active", dueDate: { gte: ts, lte: te } } }),
    prisma.chore.count({ where: { status: "active", dueDate: { gte: ws, lte: we } } }),
    prisma.choreCompletion.count({ where: { completedAt: { gte: ws, lte: we } } }),
    prisma.chore.findMany({ where: { important: true, status: "active" }, take: 3, select: { title: true } }),
    prisma.chore.findMany({
      where: { status: "active", dueDate: { gte: ts, lte: we } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 3,
      select: { title: true }
    })
  ]);

  if (todayCount === 0 && weekActive === 0 && important.length === 0) {
    return NextResponse.json({ ok: true, skipped: "empty week" });
  }

  const title = todayCount > 0
    ? `FamilyOS · ${todayCount} today · ${weekActive} this week`
    : `FamilyOS · ${weekActive} chores this week`;

  const sampleLine = samples.length > 0 ? samples.map((s) => s.title).join(" · ") : "Nothing scheduled.";
  const importantLine = important.length > 0
    ? ` ★ ${important.map((i) => i.title).join(" · ")}`
    : "";
  const doneLine = weekDone > 0 ? ` · ${weekDone} already done` : "";

  try {
    const result = await sendToAll({
      title,
      body: `${sampleLine}${doneLine}${importantLine}`.slice(0, 300),
      url: "/",
      tag: "familyos-weekly"
    });
    return NextResponse.json({ ok: true, ...result, todayCount, weekActive, weekDone });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

export const GET = handler;
export const POST = handler;
