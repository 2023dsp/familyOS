import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { getActiveHouseholdId } from "../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional()
});

async function requireOwnerOrAdmin(): Promise<{ householdId: string; userId: string } | NextResponse> {
  const session = await getSession();
  const householdId = await getActiveHouseholdId();
  if (!session?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const m = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: session.uid, householdId } }
  });
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { householdId, userId: session.uid };
}

export async function GET() {
  const householdId = await getActiveHouseholdId();
  const h = await prisma.household.findUnique({ where: { id: householdId } });
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ household: { id: h.id, name: h.name } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerOrAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.household.update({
    where: { id: auth.householdId },
    data: { ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}) }
  });
  return NextResponse.json({ household: { id: updated.id, name: updated.name } });
}
