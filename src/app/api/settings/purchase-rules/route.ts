import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveHouseholdId } from "../../../../lib/household";
import { DEFAULT_PURCHASE_RULES, getPurchaseRules, researchConfigured, setPurchaseRules } from "../../../../lib/purchase-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const householdId = await getActiveHouseholdId();
  const rules = await getPurchaseRules(householdId);
  return NextResponse.json({ rules, isDefault: rules === DEFAULT_PURCHASE_RULES, configured: researchConfigured() });
}

const schema = z.object({ rules: z.string().max(5000).nullable() });

export async function PUT(req: NextRequest) {
  const householdId = await getActiveHouseholdId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  await setPurchaseRules(householdId, parsed.data.rules);
  const rules = await getPurchaseRules(householdId);
  return NextResponse.json({ ok: true, rules, isDefault: rules === DEFAULT_PURCHASE_RULES });
}
