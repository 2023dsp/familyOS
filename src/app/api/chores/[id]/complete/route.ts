import { NextResponse, type NextRequest } from "next/server";
import { completeChore, uncompleteChore } from "@/lib/chores";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { memberSlug?: string; undo?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  try {
    if (body.undo) {
      const chore = await uncompleteChore(id);
      return NextResponse.json({ chore });
    }
    const result = await completeChore(id, body.memberSlug);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
