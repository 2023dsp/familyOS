import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reminderId: string }> }
) {
  const { id, reminderId } = await params;
  await prisma.choreReminder.deleteMany({ where: { id: reminderId, choreId: id } });
  return NextResponse.json({ ok: true });
}
