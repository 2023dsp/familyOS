import { NextResponse } from "next/server";
import { disconnectGoogle } from "../../../../lib/google";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";

export async function POST() {
  const householdId = await getActiveHouseholdId();
  await disconnectGoogle(householdId);
  return NextResponse.json({ ok: true });
}
