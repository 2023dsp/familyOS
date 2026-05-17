import { NextResponse } from "next/server";
import { syncGoogleCalendar } from "../../../../lib/google";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const householdId = await getActiveHouseholdId();
    const result = await syncGoogleCalendar(householdId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
