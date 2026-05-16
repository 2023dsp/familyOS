import { NextResponse, type NextRequest } from "next/server";
import { persistTokensFromCode } from "../../../../lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("familyos_oauth_state")?.value;

  const fail = (msg: string) => {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = `?google=error&message=${encodeURIComponent(msg)}`;
    return NextResponse.redirect(url);
  };

  if (error) return fail(error);
  if (!code) return fail("missing_code");
  if (!state || state !== cookieState) return fail("state_mismatch");

  try {
    await persistTokensFromCode(code);
  } catch (e) {
    return fail((e as Error).message);
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "?google=connected";
  const res = NextResponse.redirect(url);
  res.cookies.set("familyos_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
