import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl } from "../../../../lib/google";

export const runtime = "nodejs";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("familyos_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return res;
}
