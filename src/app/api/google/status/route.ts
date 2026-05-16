import { NextResponse } from "next/server";
import { getGoogleStatus } from "../../../../lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getGoogleStatus());
}
