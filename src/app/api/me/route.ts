import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { getActiveHouseholdId } from "../../../lib/household";
import { isSuperAdminEmail } from "../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const householdId = await getActiveHouseholdId();

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true } } } }
    }
  });

  let user: { id: string; email: string; name: string | null } | null = null;
  if (session?.uid) {
    const u = await prisma.user.findUnique({ where: { id: session.uid }, select: { id: true, email: true, name: true } });
    if (u) user = u;
  }

  return NextResponse.json({
    user,
    isKiosk: !session?.uid,
    isSuperAdmin: isSuperAdminEmail(user?.email),
    household: household
      ? {
          id: household.id,
          name: household.name,
          members: household.members.map((m) => ({
            id: m.id,
            role: m.role,
            name: m.displayName ?? m.user.name ?? m.user.email,
            email: m.user.email
          }))
        }
      : null
  });
}
