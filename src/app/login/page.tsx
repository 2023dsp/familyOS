"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "../../components/Icon";
import { ThemeToggle } from "../../components/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/v2/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 429) {
        setError("Too many attempts. Try again later.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Wrong email or password.");
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

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Good night" :
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 21 ? "Good evening" : "Good night";

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
        style={{ width: "100%", maxWidth: 460, textAlign: "center", padding: "16px 0" }}
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
        <h1 style={{ margin: "0 0 6px", fontSize: 30, fontWeight: 800, letterSpacing: -0.02 }}>{greeting}</h1>
        <p style={{ margin: "0 0 24px", color: "var(--ink-2)", fontSize: 14 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ fontSize: 15, padding: "14px 16px" }}
            required
            autoComplete="email"
          />
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ fontSize: 15, padding: "14px 16px" }}
            required
            autoComplete="current-password"
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !email || !password}
            style={{ padding: "16px 22px", fontSize: 15, borderRadius: 18 }}
          >
            {loading ? "Opening…" : "Sign in"}
          </button>
        </div>

        {error && <p style={{ marginTop: 14, color: "var(--danger)", fontWeight: 700 }}>{error}</p>}

        <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 13 }}>
          New here?{" "}
          <Link href="/register" style={{ color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}>
            Create a household
          </Link>
        </p>
        <p style={{ marginTop: 6, color: "var(--ink-3)", fontSize: 13 }}>
          <Link href="/forgot" style={{ color: "var(--ink-2)", fontWeight: 700, textDecoration: "none" }}>
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}
