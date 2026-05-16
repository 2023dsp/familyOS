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

  // 1) Multi-reminder rows (new model)
  const dueMulti = await prisma.choreReminder.findMany({
    where: { sentAt: null, scheduledAt: { lte: now } },
    include: { chore: { select: { title: true, status: true } } }
  });
  let fired = 0;
  for (const r of dueMulti) {
    if (r.chore.status === "archived") {
      // skip archived chores but still mark sent so we don't re-evaluate
      await prisma.choreReminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
      continue;
    }
    try {
      await sendToAll({
        title: "⏰ Reminder",
        body: r.chore.title,
        url: "/",
        tag: `reminder-${r.id}`
      });
      fired++;
    } catch {
      /* ignore */
    }
    await prisma.choreReminder.update({ where: { id: r.id }, data: { sentAt: new Date() } });
  }

  // 2) Legacy single reminderAt (back-compat)
  const dueLegacy = await prisma.chore.findMany({
    where: { status: "active", reminderAt: { lte: now, not: null }, reminderSentAt: null },
    select: { id: true, title: true }
  });
  for (const ch of dueLegacy) {
    try {
      await sendToAll({ title: "⏰ Reminder", body: ch.title, url: "/", tag: `reminder-legacy-${ch.id}` });
      fired++;
    } catch {
      /* ignore */
    }
    await prisma.chore.update({ where: { id: ch.id }, data: { reminderSentAt: new Date() } });
  }

  return NextResponse.json({ ok: true, fired, multi: dueMulti.length, legacy: dueLegacy.length });
}

export const GET = handler;
export const POST = handler;
