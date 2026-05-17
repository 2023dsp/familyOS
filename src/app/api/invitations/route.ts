import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "../../../lib/prisma";
import { getSession } from "../../../lib/auth";
import { getActiveHouseholdId } from "../../../lib/household";
import { sendEmail, inviteEmailHtml } from "../../../lib/email";
import { publicBaseUrl } from "../../../lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// child = FamilyMember with isChild=true, not a login user → handled separately in family-members API.
const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member")
});

async function requireOwnerOrAdmin(): Promise<{ householdId: string; userId: string } | NextResponse> {
  const session = await getSession();
  const householdId = await getActiveHouseholdId();
  if (!session?.uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await prisma.householdMember.findUnique({
    where: { userId_householdId: { userId: session.uid, householdId } }
  });
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { householdId, userId: session.uid };
}

export async function GET() {
  const auth = await requireOwnerOrAdmin();
  if (auth instanceof NextResponse) return auth;
  const invites = await prisma.householdInvitation.findMany({
    where: { householdId: auth.householdId, acceptedAt: null },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({
    invitations: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
      token: i.token
    }))
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerOrAdmin();
  if (auth instanceof NextResponse) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Already a member of this household?
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const already = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId: existingUser.id, householdId: auth.householdId } }
    });
    if (already) return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.householdInvitation.create({
    data: {
      householdId: auth.householdId,
      email,
      role: parsed.data.role,
      token,
      expiresAt
    }
  });

  // Build accept URL + send email
  const household = await prisma.household.findUnique({ where: { id: auth.householdId } });
  const inviter = await prisma.user.findUnique({ where: { id: auth.userId } });
  const acceptUrl = `${publicBaseUrl(req)}/accept-invite?token=${encodeURIComponent(token)}`;
  const send = await sendEmail({
    to: email,
    subject: `You're invited to join ${household?.name ?? "FamilyOS"}`,
    html: inviteEmailHtml({
      householdName: household?.name ?? "FamilyOS",
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
      acceptUrl
    })
  });

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptUrl,
      token: invitation.token
    },
    emailSent: send.ok,
    emailError: send.ok ? undefined : send.error
  });
}
