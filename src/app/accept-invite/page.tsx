"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../../components/Icon";

type InviteInfo = {
  email: string;
  role: string;
  householdName: string;
  expiresAt: string;
  userExists: boolean;
};

function AcceptInviteForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "expired" | "used" | "done">("checking");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.ok) {
          setInfo((await r.json()).invitation);
          setStatus("ready");
          return;
        }
        if (r.status === 410) {
          const j = await r.json().catch(() => ({}));
          setStatus(j.error?.toLowerCase().includes("used") ? "used" : "expired");
          return;
        }
        setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.userExists) {
      if (password !== confirm) {
        setError("Passwords don't match.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          ...(info?.userExists ? {} : { name: name.trim() || undefined })
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed");
        return;
      }
      setStatus("done");
      setTimeout(() => router.replace("/"), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(160deg, var(--surface) 0%, var(--bg) 60%)"
      }}
    >
      <div className="fade-in" style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 18px",
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--terracotta-soft)"
          }}
        >
          <Icon name="users" color="var(--terracotta-deep)" size={26} />
        </div>

        {status === "checking" && <p className="muted">Checking invitation…</p>}

        {(status === "invalid" || status === "expired" || status === "used") && (
          <div className="card" style={{ padding: 16 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>
              {status === "expired" ? "Invitation expired" : status === "used" ? "Invitation already used" : "Invalid link"}
            </h1>
            <p className="muted" style={{ fontSize: 13 }}>Ask the household owner to send a new one.</p>
            <Link href="/login" style={{ display: "inline-block", marginTop: 14, color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}>
              Go to sign-in
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>Welcome! Redirecting to your household…</p>
          </div>
        )}

        {status === "ready" && info && (
          <>
            <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800 }}>Join {info.householdName}</h1>
            <p style={{ margin: "0 0 4px", color: "var(--ink-2)", fontSize: 14 }}>
              Invited as <strong>{info.role}</strong>
            </p>
            <p style={{ margin: "0 0 22px", color: "var(--ink-3)", fontSize: 13 }}>
              {info.email}
            </p>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {info.userExists ? (
                <input
                  type="password"
                  className="input"
                  placeholder="Your existing password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ fontSize: 15, padding: "14px 16px" }}
                />
              ) : (
                <>
                  <input
                    type="text"
                    className="input"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    style={{ fontSize: 15, padding: "14px 16px" }}
                  />
                  <input
                    type="password"
                    className="input"
                    placeholder="Choose a password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    style={{ fontSize: 15, padding: "14px 16px" }}
                  />
                  <input
                    type="password"
                    className="input"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    style={{ fontSize: 15, padding: "14px 16px" }}
                  />
                </>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !password}
                style={{ padding: "14px 22px", fontSize: 15, borderRadius: 16 }}
              >
                {loading ? "Joining…" : "Accept & join"}
              </button>
              {error && <p style={{ color: "var(--danger)", fontWeight: 700, margin: 0 }}>{error}</p>}
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
