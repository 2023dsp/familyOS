import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const templates = await prisma.choreTemplate.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json({ templates });
}
