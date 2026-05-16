"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../components/Icon";
import { ThemeToggle } from "../../components/ThemeToggle";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (res.status === 429) {
        setError("Too many attempts. Try again later.");
        return;
      }
      if (!res.ok) {
        setError("Wrong password.");
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
  const greeting = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";

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
        style={{
          width: "100%",
          maxWidth: 480,
          textAlign: "center",
          padding: "16px 0"
        }}
      >
        <div
          style={{
            margin: "0 auto 28px",
            display: "grid",
            placeItems: "center",
            width: 72,
            height: 72,
            borderRadius: 22,
            background: "linear-gradient(135deg, var(--terracotta), var(--terracotta-deep))",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          <Icon name="home" color="white" accent="rgba(255,255,255,0.6)" size={36} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 36, fontWeight: 800, letterSpacing: -0.02 }}>
          {greeting}, family
        </h1>
        <p style={{ margin: "0 0 32px", color: "var(--ink-2)", fontSize: 15 }}>
          {process.env.NEXT_PUBLIC_FAMILY_NAMES ?? "Davide & Luize"} · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            className="input"
            placeholder="Family password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ fontSize: 18, padding: "18px 22px", textAlign: "center", letterSpacing: 4 }}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !password} style={{ padding: "18px 22px", fontSize: 16, borderRadius: 18 }}>
            {loading ? "Opening…" : "Open the home"}
          </button>
        </div>

        {error && <p style={{ marginTop: 16, color: "var(--danger)", fontWeight: 700 }}>{error}</p>}

        <p style={{ marginTop: 28, color: "var(--ink-4)", fontSize: 13 }}>Only the family lives here. No accounts. No tracking.</p>
      </form>
    </main>
  );
}
