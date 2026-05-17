import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "../../../../../lib/prisma";
import { sendEmail, resetEmailHtml } from "../../../../../lib/email";
import { publicBaseUrl } from "../../../../../lib/url";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return ok to avoid email enumeration.
  if (!user) return NextResponse.json({ ok: true });

  // Invalidate any existing unused tokens.
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() }
  });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt }
  });

  const resetUrl = `${publicBaseUrl(req)}/reset?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your FamilyOS password",
    html: resetEmailHtml({ name: user.name, resetUrl })
  });

  return NextResponse.json({ ok: true });
}
