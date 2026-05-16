import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  label: z.string().min(1).max(80)
});

const KEYS = ["weather_lat", "weather_lon", "weather_label"];

async function readAll() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: KEYS } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function write(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function GET() {
  const m = await readAll();
  const lat = parseFloat(m.weather_lat ?? "");
  const lon = parseFloat(m.weather_lon ?? "");
  return NextResponse.json({
    config: Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon, label: m.weather_label ?? "" }
      : null
  });
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
  await Promise.all([
    write("weather_lat", String(parsed.data.lat)),
    write("weather_lon", String(parsed.data.lon)),
    write("weather_label", parsed.data.label)
  ]);
  return NextResponse.json({ ok: true, config: parsed.data });
}

export async function DELETE() {
  await prisma.appSetting.deleteMany({ where: { key: { in: KEYS } } });
  return NextResponse.json({ ok: true });
}
