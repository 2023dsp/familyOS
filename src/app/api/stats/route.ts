import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "../../../lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const ts = startOfDay(now);
  const te = endOfDay(now);
  const ws = startOfWeek(now);
  const we = endOfWeek(now);

  const liveChore = { chore: { status: { not: "archived" as const } } };
  const liveChoreFilter = { status: { not: "archived" as const } };

  const [todayDone, todayTotal, weekDone, weekTotal, davideDone, luizeDone, streakRaw] = await Promise.all([
    prisma.choreCompletion.count({ where: { completedAt: { gte: ts, lte: te }, ...liveChore } }),
    prisma.chore.count({ where: { dueDate: { gte: ts, lte: te }, ...liveChoreFilter } }),
    prisma.choreCompletion.count({ where: { completedAt: { gte: ws, lte: we }, ...liveChore } }),
    prisma.chore.count({
      where: {
        ...liveChoreFilter,
        OR: [{ dueDate: { gte: ws, lte: we } }, { completedAt: { gte: ws, lte: we } }]
      }
    }),
    prisma.choreCompletion.count({
      where: { completedAt: { gte: ws, lte: we }, member: { slug: "davide" }, ...liveChore }
    }),
    prisma.choreCompletion.count({
      where: { completedAt: { gte: ws, lte: we }, member: { slug: "luize" }, ...liveChore }
    }),
    prisma.choreCompletion.findMany({
      where: liveChore,
      orderBy: { completedAt: "desc" },
      take: 60,
      select: { completedAt: true }
    })
  ]);

  // streak = consecutive days (ending today or yesterday) with at least 1 completion
  const days = new Set(
    streakRaw.map((r) => {
      const d = startOfDay(r.completedAt);
      return d.toISOString().slice(0, 10);
    })
  );
  let streak = 0;
  const cursor = startOfDay(now);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const score = Math.min(
    100,
    Math.round((weekTotal === 0 ? 0 : (weekDone / weekTotal) * 70) + Math.min(30, streak * 3))
  );

  return NextResponse.json({
    today: { done: todayDone, total: todayTotal },
    week: { done: weekDone, total: weekTotal },
    perMember: { davide: davideDone, luize: luizeDone },
    streak,
    score
  });
}
