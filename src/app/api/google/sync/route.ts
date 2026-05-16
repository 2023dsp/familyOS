import { NextResponse } from "next/server";
import { syncGoogleCalendar } from "../../../../lib/google";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await syncGoogleCalendar();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
