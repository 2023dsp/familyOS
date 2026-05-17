import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getSession } from "./auth";

export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

export async function requireSuperAdmin(): Promise<{ email: string } | NextResponse> {
  const session = await getSession();
  if (!session?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.uid }, select: { email: true } });
  if (!user || !isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { email: user.email };
}
