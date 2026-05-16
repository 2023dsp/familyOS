import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToAll } from "../../../../lib/push";
import { startOfDay, endOfDay } from "../../../../lib/date";

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

  const todayChores = await prisma.chore.findMany({
    where: { status: "active", dueDate: { gte: ts, lte: te } },
    orderBy: { priority: "desc" }
  });
  const important = await prisma.chore.count({ where: { important: true, status: "active" } });

  if (todayChores.length === 0 && important === 0) {
    return NextResponse.json({ ok: true, skipped: "nothing to notify" });
  }

  const top = todayChores.slice(0, 3).map((c) => c.title).join(" · ");
  const more = todayChores.length > 3 ? ` (+${todayChores.length - 3} more)` : "";
  const body = todayChores.length > 0
    ? `${todayChores.length} chore${todayChores.length > 1 ? "s" : ""} today: ${top}${more}`
    : `${important} important task${important > 1 ? "s" : ""} pinned.`;

  try {
    const result = await sendToAll({
      title: "FamilyOS · today",
      body,
      url: "/",
      tag: "familyos-digest"
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

export const GET = handler;
export const POST = handler;
