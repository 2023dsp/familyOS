import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

const patchSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  icon: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  colorSoft: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    const cat = await prisma.category.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ category: cat });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!cat.isCustom) {
    return NextResponse.json({ error: "Default categories cannot be deleted, only edited." }, { status: 400 });
  }
  const usage = await prisma.chore.count({ where: { category: cat.slug } });
  if (usage > 0) {
    return NextResponse.json({ error: `${usage} chores still use this category. Re-assign them first.` }, { status: 409 });
  }
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
