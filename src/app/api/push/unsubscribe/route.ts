import { NextResponse, type NextRequest } from "next/server";
import { removeSubscription } from "../../../../lib/push";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { endpoint?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
