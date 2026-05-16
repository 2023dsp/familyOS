import { NextResponse } from "next/server";
import { sendToAll } from "../../../../lib/push";

export const runtime = "nodejs";

export async function POST() {
  try {
    const out = await sendToAll({
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
