import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

const schema = z.object({ scheduledAt: z.string().datetime() });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reminders = await prisma.choreReminder.findMany({
    where: { choreId: id },
    orderBy: { scheduledAt: "asc" }
  });
  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const chore = await prisma.chore.findUnique({ where: { id } });
  if (!chore) return NextResponse.json({ error: "Chore not found" }, { status: 404 });
  const reminder = await prisma.choreReminder.create({
    data: {
      choreId: id,
      scheduledAt: new Date(parsed.data.scheduledAt)
    }
  });
  return NextResponse.json({ reminder }, { status: 201 });
}
