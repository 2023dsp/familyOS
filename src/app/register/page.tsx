"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "../../components/Icon";
import { ThemeToggle } from "../../components/ThemeToggle";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/v2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name || undefined,
          householdName: householdName || `${name || "Our"} household`
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not create account.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error.");
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
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle compact />
      </div>

      <form
        onSubmit={submit}
        className="fade-in"
        style={{ width: "100%", maxWidth: 460, textAlign: "left", padding: "16px 0" }}
      >
        <div
          style={{
            margin: "0 auto 24px",
            display: "grid",
            placeItems: "center",
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "linear-gradient(135deg, var(--terracotta), var(--terracotta-deep))",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          <Icon name="home" color="white" accent="rgba(255,255,255,0.6)" size={32} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: -0.02, textAlign: "center" }}>
          Create a household
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--ink-2)", fontSize: 14, textAlign: "center" }}>
          One account, one shared family workspace. You can invite the rest later.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Your name">
            <input
              type="text"
              className="input"
              placeholder="Davide"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: 15, padding: "12px 14px" }}
              autoComplete="name"
            />
          </Field>
          <Field label="Household name">
            <input
              type="text"
              className="input"
              placeholder="Speranza family"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              style={{ fontSize: 15, padding: "12px 14px" }}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ fontSize: 15, padding: "12px 14px" }}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className="input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ fontSize: 15, padding: "12px 14px" }}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </Field>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !email || !password || password.length < 8}
            style={{ padding: "14px 22px", fontSize: 15, borderRadius: 18, marginTop: 6 }}
          >
            {loading ? "Creating…" : "Create household"}
          </button>
        </div>

        {error && <p style={{ marginTop: 14, color: "var(--danger)", fontWeight: 700, textAlign: "center" }}>{error}</p>}

        <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 13, textAlign: "center" }}>
          Have an account?{" "}
          <Link href="/login" style={{ color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>
        {label}
      </span>
      {children}
    </div>
  );
}
