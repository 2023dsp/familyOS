import { NextResponse, type NextRequest } from "next/server";
import { defaultSuggestionProvider } from "../../../lib/suggest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { title?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = (body.title ?? "").toString();
  const suggestion = await defaultSuggestionProvider.suggest(title);
  return NextResponse.json({ suggestion });
}
