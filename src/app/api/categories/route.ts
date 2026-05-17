import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { listCategories } from "../../../lib/categories";
import { getActiveHouseholdId } from "../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  slug: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i, "slug must be url-safe"),
  label: z.string().min(1).max(60),
  icon: z.string().min(1).max(40).default("layers"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "hex color e.g. #C97B5B"),
  colorSoft: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sortOrder: z.number().int().optional()
});

export async function GET() {
  const categories = await listCategories();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const householdId = await getActiveHouseholdId();
    const cat = await prisma.category.create({
      data: {
        slug: parsed.data.slug.toLowerCase(),
        label: parsed.data.label,
        icon: parsed.data.icon,
        color: parsed.data.color,
        colorSoft: parsed.data.colorSoft,
        sortOrder: parsed.data.sortOrder ?? 100,
        isCustom: true,
        householdId
      }
    });
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    throw e;
  }
}
