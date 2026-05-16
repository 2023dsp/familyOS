import { createHmac, timingSafeEqual, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "familyos_session";

function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short. Set it in your environment (>= 16 chars).");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function b64urlEncode(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64urlDecode(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}

export type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
  nonce: string;
};

export function createSessionToken(): string {
  const days = Number(process.env.SESSION_DAYS ?? 30);
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + days * 24 * 60 * 60,
    nonce: randomBytes(8).toString("hex")
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(plain: string): string {
  return createHash("sha256").update(plain.normalize("NFKC")).digest("hex");
}

export function checkFamilyPassword(input: string): boolean {
  if (!input) return false;
  const expectedHash =
    process.env.FAMILY_ACCESS_PASSWORD_HASH?.trim() ||
    (process.env.FAMILY_ACCESS_PASSWORD ? hashPassword(process.env.FAMILY_ACCESS_PASSWORD) : "");
  if (!expectedHash) return false;
  const candidate = hashPassword(input);
  const a = Buffer.from(candidate);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookieOptions() {
  const days = Number(process.env.SESSION_DAYS ?? 30);
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 24 * 60 * 60
  };
}

export const SESSION_COOKIE = COOKIE_NAME;

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}
