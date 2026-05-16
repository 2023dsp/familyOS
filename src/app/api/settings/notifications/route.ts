import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEFAULT_SCHEDULE, getSchedule, saveSchedule } from "../../../../lib/notify-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  daily: z.object({
    enabled: z.boolean(),
    when: z.enum(["evening-before", "morning-of"]),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59)
  }),
  weekly: z.object({
    enabled: z.boolean(),
    dow: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59)
  })
});

export async function GET() {
  const s = await getSchedule();
  return NextResponse.json({ schedule: s, defaults: DEFAULT_SCHEDULE });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  await saveSchedule(parsed.data);
  return NextResponse.json({ ok: true, schedule: parsed.data });
}
