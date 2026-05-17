import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  isChild: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const householdId = await getActiveHouseholdId();
  const existing = await prisma.familyMember.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
    data.initials = parsed.data.name.charAt(0).toUpperCase();
  }
  if (parsed.data.isChild !== undefined) data.isChild = parsed.data.isChild;
  if (parsed.data.color !== undefined) data.color = parsed.data.color;
  const member = await prisma.familyMember.update({ where: { id }, data });
  return NextResponse.json({ member });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = await getActiveHouseholdId();
  const existing = await prisma.familyMember.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.slug === "unassigned") {
    return NextResponse.json({ error: "Cannot delete reserved members" }, { status: 400 });
  }
  const usage = await prisma.chore.count({ where: { assigneeId: id, householdId } });
  if (usage > 0) {
    // Reassign chores to "unassigned" before delete
    const unassigned = await prisma.familyMember.findUnique({
      where: { householdId_slug: { householdId, slug: "unassigned" } }
    });
    await prisma.chore.updateMany({
      where: { assigneeId: id, householdId },
      data: { assigneeId: unassigned?.id ?? null }
    });
  }
  await prisma.familyMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
