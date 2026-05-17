import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { verifyPasswordV2 } from "../../../../../lib/passwords";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../../lib/auth";
import { isLoginBlocked, recordLoginAttempt } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await recordLoginAttempt(ip, false).catch(() => {});
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { memberships: { include: { household: true } } }
  });
  const ok = user ? await verifyPasswordV2(parsed.data.password, user.passwordHash) : false;
  await recordLoginAttempt(ip, ok).catch(() => {});

  if (!ok || !user) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const primaryHouseholdId = user.memberships[0]?.householdId;
  const token = createSessionToken({ userId: user.id, householdId: primaryHouseholdId });
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    households: user.memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      role: m.role
    }))
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
