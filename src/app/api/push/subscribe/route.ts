import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveSubscription } from "../../../../lib/push";

export const runtime = "nodejs";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  label: z.string().optional()
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const ua = req.headers.get("user-agent") ?? undefined;
  await saveSubscription({ ...parsed.data, userAgent: ua });
  return NextResponse.json({ ok: true });
}
