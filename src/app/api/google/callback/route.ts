import { NextResponse, type NextRequest } from "next/server";
import { persistTokensFromCode } from "../../../../lib/google";
import { publicBaseUrl } from "../../../../lib/url";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("familyos_oauth_state")?.value;
  const base = publicBaseUrl(req);

  const back = (qs: string) => {
    const url = new URL(`/${qs ? `?${qs}` : ""}`, base);
    const res = NextResponse.redirect(url);
    res.cookies.set("familyos_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error) return back(`google=error&message=${encodeURIComponent(error)}`);
  if (!code) return back(`google=error&message=missing_code`);
  if (!state || state !== cookieState) return back(`google=error&message=state_mismatch`);

  try {
    await persistTokensFromCode(code);
  } catch (e) {
    return back(`google=error&message=${encodeURIComponent((e as Error).message)}`);
  }

  return back("google=connected");
}
