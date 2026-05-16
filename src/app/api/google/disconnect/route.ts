import { NextResponse } from "next/server";
import { disconnectGoogle } from "../../../../lib/google";

export const runtime = "nodejs";

export async function POST() {
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}
