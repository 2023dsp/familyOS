import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { deleteEvent, eventInputSchema, updateEvent } from "../../../../../lib/events";
import { deleteGoogleEvent, pushLocalEventToGoogle } from "../../../../../lib/google";
import { getActiveHouseholdId } from "../../../../../lib/household";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = eventInputSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    const event = await updateEvent(id, parsed.data);
    const householdId = await getActiveHouseholdId();
    void pushLocalEventToGoogle(householdId, event.id).catch(() => {});
    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = await getActiveHouseholdId();
  const ev = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!ev || ev.householdId !== householdId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ev.externalId) void deleteGoogleEvent(householdId, ev.externalId).catch(() => {});
  await deleteEvent(id);
  return NextResponse.json({ ok: true });
}
