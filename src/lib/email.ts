import { Resend } from "resend";

const FROM_DEFAULT = "onboarding@resend.dev";

type SendArgs = { to: string; subject: string; html: string; text?: string };

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || FROM_DEFAULT;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const resend = new Resend(key);
  try {
    const res = await resend.emails.send({
      from: emailFrom(),
      to,
      subject,
      html,
      text: text ?? stripHtml(html)
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function inviteEmailHtml(opts: { householdName: string; inviterName: string; acceptUrl: string }): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f3ec;padding:32px 16px;color:#2b1f12;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 10px rgba(0,0,0,0.05)">
      <h2 style="margin:0 0 8px;font-size:20px">You're invited to join ${escapeHtml(opts.householdName)}</h2>
      <p style="margin:0 0 16px;color:#5a4a36">${escapeHtml(opts.inviterName)} invited you to their FamilyOS household.</p>
      <a href="${opts.acceptUrl}" style="display:inline-block;padding:12px 18px;background:#c97b5b;color:white;font-weight:700;border-radius:12px;text-decoration:none">Accept invitation</a>
      <p style="margin:18px 0 0;font-size:12px;color:#8b7a62">Or paste this link: <br/><span style="word-break:break-all">${escapeHtml(opts.acceptUrl)}</span></p>
      <p style="margin:18px 0 0;font-size:11px;color:#a39682">If you didn't expect this email, ignore it.</p>
    </div>
  </div>`;
}

export function resetEmailHtml(opts: { name: string | null; resetUrl: string }): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f3ec;padding:32px 16px;color:#2b1f12;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 10px rgba(0,0,0,0.05)">
      <h2 style="margin:0 0 8px;font-size:20px">Reset your password</h2>
      <p style="margin:0 0 16px;color:#5a4a36">Hi ${escapeHtml(opts.name ?? "there")}, click below to set a new password. The link expires in 1 hour.</p>
      <a href="${opts.resetUrl}" style="display:inline-block;padding:12px 18px;background:#c97b5b;color:white;font-weight:700;border-radius:12px;text-decoration:none">Reset password</a>
      <p style="margin:18px 0 0;font-size:12px;color:#8b7a62">Or paste this link: <br/><span style="word-break:break-all">${escapeHtml(opts.resetUrl)}</span></p>
      <p style="margin:18px 0 0;font-size:11px;color:#a39682">If you didn't request this, ignore the email.</p>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
