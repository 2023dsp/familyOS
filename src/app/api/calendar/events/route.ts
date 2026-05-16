import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 14);
  const events = await prisma.calendarEvent.findMany({
    where: { startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: "asc" }
  });
  return NextResponse.json({ events });
}
