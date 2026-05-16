import { NextResponse } from "next/server";
import { getPublicKey } from "../../../../lib/push";

export const runtime = "nodejs";

export async function GET() {
  const key = getPublicKey();
  if (!key) return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  return NextResponse.json({ publicKey: key });
}
