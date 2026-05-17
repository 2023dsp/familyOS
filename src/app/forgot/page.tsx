"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "../../components/Icon";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/v2/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setDone(true);
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
      <form onSubmit={submit} className="fade-in" style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
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
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800 }}>Forgot password</h1>
        <p style={{ margin: "0 0 22px", color: "var(--ink-2)", fontSize: 14 }}>
          Enter your email — we'll send a reset link.
        </p>

        {done ? (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>If that email is registered, a reset link is on its way.</p>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>Check your inbox (and spam folder).</p>
            <Link
              href="/login"
              style={{ display: "inline-block", marginTop: 14, color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <input
              type="email"
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ fontSize: 15, padding: "14px 16px", marginBottom: 12 }}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !email}
              style={{ padding: "14px 22px", fontSize: 15, borderRadius: 16, width: "100%" }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <p style={{ marginTop: 18, fontSize: 13 }}>
              <Link href="/login" style={{ color: "var(--ink-2)", fontWeight: 700, textDecoration: "none" }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </form>
    </main>
  );
}
