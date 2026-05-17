"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../../components/Icon";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/auth/v2/reset?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? setStatus("ready") : setStatus("invalid")))
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/v2/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed");
        return;
      }
      setStatus("done");
      setTimeout(() => router.replace("/login"), 1500);
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
      <div className="fade-in" style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
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
          <Icon name="link" color="var(--terracotta-deep)" size={26} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800 }}>Reset password</h1>

        {status === "checking" && <p className="muted">Checking link…</p>}

        {status === "invalid" && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>This reset link is invalid or expired.</p>
            <Link
              href="/forgot"
              style={{ display: "inline-block", marginTop: 14, color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}
            >
              Request a new one
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>Password updated. Redirecting to sign-in…</p>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              className="input"
              placeholder="New password (min 8 chars)"
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
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !password || !confirm}
              style={{ padding: "14px 22px", fontSize: 15, borderRadius: 16 }}
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
            {error && <p style={{ color: "var(--danger)", fontWeight: 700, margin: 0 }}>{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
