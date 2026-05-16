import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendToAll } from "../../../../lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if ((req.headers.get("x-cron-secret") ?? "") !== secret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  // Find chores whose reminder has come due but hasn't been fired yet.
  const due = await prisma.chore.findMany({
    where: {
      status: "active",
      reminderAt: { lte: now, not: null },
      reminderSentAt: null
    },
    select: { id: true, title: true, reminderAt: true }
  });

  let fired = 0;
  for (const ch of due) {
    try {
      await sendToAll({
        title: "⏰ Reminder",
        body: ch.title,
        url: "/",
        tag: `reminder-${ch.id}`
      });
      fired++;
    } catch {
      /* ignore push errors per-chore */
    }
    await prisma.chore.update({ where: { id: ch.id }, data: { reminderSentAt: new Date() } });
  }
  return NextResponse.json({ ok: true, fired, considered: due.length });
}

export const GET = handler;
export const POST = handler;
