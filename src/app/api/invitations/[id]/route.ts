import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSession } from "../../../../lib/auth";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const householdId = await getActiveHouseholdId();
  const me = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: session.uid, householdId } }
  });
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const inv = await prisma.householdInvitation.findUnique({ where: { id } });
  if (!inv || inv.householdId !== householdId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.householdInvitation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
