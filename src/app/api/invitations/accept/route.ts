import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { hashPasswordV2, verifyPasswordV2 } from "../../../../lib/passwords";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).optional()
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const inv = await prisma.householdInvitation.findUnique({ where: { token: parsed.data.token } });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: "Invitation already used" }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expired" }, { status: 410 });

  const email = inv.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  let userId: string;
  if (existing) {
    // Existing account: password must match — we don't change it from this flow.
    const ok = await verifyPasswordV2(parsed.data.password, existing.passwordHash);
    if (!ok) return NextResponse.json({ error: "Wrong password for existing account" }, { status: 401 });
    userId = existing.id;
  } else {
    const passwordHash = await hashPasswordV2(parsed.data.password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: parsed.data.name ?? null }
    });
    userId = user.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.householdMember.upsert({
      where: { userId_householdId: { userId, householdId: inv.householdId } },
      update: {},
      create: {
        userId,
        householdId: inv.householdId,
        role: inv.role,
        displayName: parsed.data.name ?? null
      }
    });
    await tx.householdInvitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() }
    });
  });

  const token = createSessionToken({ userId, householdId: inv.householdId });
  const res = NextResponse.json({ ok: true, householdId: inv.householdId });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

// GET — verify a token (for pre-fill on the accept page)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const inv = await prisma.householdInvitation.findUnique({ where: { token } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.acceptedAt) return NextResponse.json({ error: "Already used" }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });
  const household = await prisma.household.findUnique({ where: { id: inv.householdId } });
  const userExists = (await prisma.user.findUnique({ where: { email: inv.email.toLowerCase() } })) != null;
  return NextResponse.json({
    invitation: {
      email: inv.email,
      role: inv.role,
      householdName: household?.name ?? "FamilyOS",
      expiresAt: inv.expiresAt.toISOString(),
      userExists
    }
  });
}
