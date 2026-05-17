import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createEvent, eventInputSchema } from "../../../../lib/events";
import { pushLocalEventToGoogle } from "../../../../lib/google";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = toStr ? new Date(toStr) : new Date(from.getTime() + 14 * 86400_000);

  const householdId = await getActiveHouseholdId();
  const events = await prisma.calendarEvent.findMany({
    where: { householdId, startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: "asc" }
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const event = await createEvent(parsed.data);
  // Fire-and-forget push to Google if connected
  void pushLocalEventToGoogle(event.id).catch(() => {});
  return NextResponse.json({ event }, { status: 201 });
}
