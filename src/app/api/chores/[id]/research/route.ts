import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getActiveHouseholdId } from "../../../../../lib/household";
import { canStartResearch, researchConfigured, startResearch } from "../../../../../lib/purchase-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOwned(id: string) {
  const householdId = await getActiveHouseholdId();
  return prisma.chore.findFirst({ where: { id, householdId } });
}

// GET — research status for polling
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chore = await findOwned(id).catch(() => null);
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    isPurchase: chore.isPurchase,
    purchaseDescription: chore.purchaseDescription,
    researchStatus: chore.researchStatus,
    researchResult: chore.researchResult,
    researchError: chore.researchError,
    researchedAt: chore.researchedAt,
    configured: researchConfigured()
  });
}

// POST — (re)start the research agent
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chore = await findOwned(id).catch(() => null);
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!chore.isPurchase) return NextResponse.json({ error: "Not a purchase" }, { status: 400 });
  if (!canStartResearch(chore)) return NextResponse.json({ error: "Research already running" }, { status: 409 });
  await startResearch(chore.id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
