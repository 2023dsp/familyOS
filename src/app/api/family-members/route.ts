import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getActiveHouseholdId } from "../../../lib/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = ["#6F8AA8", "#D89AA0", "#3F4B3B", "#D9B36C", "#A85F40", "#6B8E5A", "#5C4F3F", "#D88A3A"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

const inputSchema = z.object({
  name: z.string().min(1).max(60),
  isChild: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

export async function GET() {
  const householdId = await getActiveHouseholdId();
  const members = await prisma.familyMember.findMany({
    where: { householdId, isPerson: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const householdId = await getActiveHouseholdId();
  const existingCount = await prisma.familyMember.count({ where: { householdId, isPerson: true } });
  const color = parsed.data.color ?? PALETTE[existingCount % PALETTE.length] ?? "#5C4F3F";
  let slug = slugify(parsed.data.name) || `member-${Date.now()}`;
  // Ensure unique slug within household
  let n = 1;
  while (await prisma.familyMember.findUnique({ where: { householdId_slug: { householdId, slug } } })) {
    slug = `${slugify(parsed.data.name)}-${n++}`;
  }
  try {
    const member = await prisma.familyMember.create({
      data: {
        slug,
        name: parsed.data.name,
        initials: parsed.data.name.charAt(0).toUpperCase(),
        color,
        isPerson: true,
        isChild: parsed.data.isChild ?? false,
        sortOrder: existingCount,
        householdId
      }
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
