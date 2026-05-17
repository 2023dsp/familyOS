import { NextResponse } from "next/server";
import { sendToHousehold } from "../../../../lib/push";
import { getActiveHouseholdId } from "../../../../lib/household";

export const runtime = "nodejs";

export async function POST() {
  let householdId: string;
  try {
    householdId = await getActiveHouseholdId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const out = await sendToHousehold(householdId, {
      title: "FamilyOS test",
      body: "If you see this, push notifications work on this device.",
      url: "/",
      tag: "familyos-test"
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
