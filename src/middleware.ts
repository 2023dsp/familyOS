import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_EDGE, verifySessionTokenEdge } from "@/lib/auth-edge";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|login|api/auth/login).*)"]
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_EDGE)?.value;
  const secret = process.env.SESSION_SECRET ?? "";
  const ok = await verifySessionTokenEdge(token, secret);
  if (ok) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
