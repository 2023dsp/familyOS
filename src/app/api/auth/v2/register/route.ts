import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { hashPasswordV2 } from "../../../../../lib/passwords";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../../lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).optional(),
  householdName: z.string().min(1).max(80).default("Our home")
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

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await hashPasswordV2(parsed.data.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        name: parsed.data.name ?? null
      }
    });
    const household = await tx.household.create({
      data: { name: parsed.data.householdName, ownerId: user.id }
    });
    await tx.householdMember.create({
      data: { userId: user.id, householdId: household.id, role: "owner", displayName: parsed.data.name ?? null }
    });
    return { user, household };
  });

  // Reuse the existing HMAC session token while multi-tenant migration is staged.
  const token = createSessionToken();
  const res = NextResponse.json({
    ok: true,
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
    household: { id: result.household.id, name: result.household.name }
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
