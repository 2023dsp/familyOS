import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastLoginAt: true,
      memberships: { select: { householdId: true, role: true, household: { select: { name: true } } } }
    }
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      households: u.memberships.map((m) => ({
        id: m.householdId,
        name: m.household.name,
        role: m.role
      }))
    }))
  });
}
