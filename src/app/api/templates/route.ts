import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getActiveHouseholdId } from "../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const householdId = await getActiveHouseholdId();
  const templates = await prisma.choreTemplate.findMany({
    where: { householdId },
    orderBy: { title: "asc" }
  });
  return NextResponse.json({ templates });
}
