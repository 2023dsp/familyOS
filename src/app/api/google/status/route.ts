import { NextResponse } from "next/server";
import { getGoogleStatus } from "../../../../lib/google";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const householdId = await getActiveHouseholdId();
  return NextResponse.json(await getGoogleStatus(householdId));
}
