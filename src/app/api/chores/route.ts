import { NextResponse, type NextRequest } from "next/server";
import { choreInputSchema, createChore, listChores } from "../../../lib/chores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as "active" | "completed" | "archived" | "all" | null;
  const chores = await listChores({ status: status ?? "active" });
  return NextResponse.json({ chores });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = choreInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const chore = await createChore(parsed.data);
  return NextResponse.json({ chore }, { status: 201 });
}
