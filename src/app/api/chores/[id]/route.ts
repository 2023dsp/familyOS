import { NextResponse, type NextRequest } from "next/server";
import { archiveChore, choreInputSchema, updateChore } from "../../../../lib/chores";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = choreInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const chore = await updateChore(id, parsed.data);
    return NextResponse.json({ chore });
  } catch {
    return NextResponse.json({ error: "Chore not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const chore = await archiveChore(id);
    return NextResponse.json({ chore });
  } catch {
    return NextResponse.json({ error: "Chore not found" }, { status: 404 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chore = await prisma.chore.findUnique({ where: { id }, include: { assignee: true, completions: { take: 5, orderBy: { completedAt: "desc" } } } });
  if (!chore) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ chore });
}
