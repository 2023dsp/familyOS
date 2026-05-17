import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);

  const [users, households, chores, completions, events, familyMembers, loginAttempts7d, loginAttemptsOk7d, invitationsPending] =
    await Promise.all([
      prisma.user.count(),
      prisma.household.count(),
      prisma.chore.count(),
      prisma.choreCompletion.count(),
      prisma.calendarEvent.count(),
      prisma.familyMember.count(),
      prisma.loginAttempt.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.loginAttempt.count({ where: { createdAt: { gte: sevenDaysAgo }, ok: true } }),
      prisma.householdInvitation.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } })
    ]);

  return NextResponse.json({
    overview: {
      users,
      households,
      chores,
      completions,
      events,
      familyMembers,
      invitationsPending,
      loginAttempts7d,
      loginAttemptsOk7d,
      loginAttemptsFailed7d: loginAttempts7d - loginAttemptsOk7d
    }
  });
}
