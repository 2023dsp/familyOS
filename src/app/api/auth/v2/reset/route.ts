import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { hashPasswordV2 } from "../../../../../lib/passwords";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200)
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

  const row = await prisma.passwordReset.findUnique({ where: { token: parsed.data.token } });
  if (!row) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (row.usedAt) return NextResponse.json({ error: "Token already used" }, { status: 410 });
  if (row.expiresAt < new Date()) return NextResponse.json({ error: "Token expired" }, { status: 410 });

  const passwordHash = await hashPasswordV2(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } })
  ]);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const row = await prisma.passwordReset.findUnique({ where: { token } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.usedAt) return NextResponse.json({ error: "Already used" }, { status: 410 });
  if (row.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });
  return NextResponse.json({ ok: true });
}
