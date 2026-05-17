import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const households = await prisma.household.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: { select: { email: true, name: true } },
      _count: {
        select: {
          members: true,
          chores: true,
          events: true,
          familyMembers: true
        }
      }
    }
  });

  return NextResponse.json({
    households: households.map((h) => ({
      id: h.id,
      name: h.name,
      ownerEmail: h.owner?.email ?? null,
      ownerName: h.owner?.name ?? null,
      createdAt: h.createdAt.toISOString(),
      memberCount: h._count.members,
      choreCount: h._count.chores,
      eventCount: h._count.events,
      familyMemberCount: h._count.familyMembers
    }))
  });
}
