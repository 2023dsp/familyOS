import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;

  const attempts = await prisma.loginAttempt.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      ip: a.ip,
      ok: a.ok,
      createdAt: a.createdAt.toISOString()
    }))
  });
}
