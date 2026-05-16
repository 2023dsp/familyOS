import { NextResponse, type NextRequest } from "next/server";
import { checkFamilyPassword, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/auth";
import { isLoginBlocked, recordLoginAttempt } from "../../../../lib/rate-limit";

export const runtime = "nodejs";

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ok = checkFamilyPassword(password);
  await recordLoginAttempt(ip, ok).catch(() => {});

  if (!ok) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
