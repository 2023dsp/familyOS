"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../../components/Icon";

type Overview = {
  users: number;
  households: number;
  chores: number;
  completions: number;
  events: number;
  familyMembers: number;
  invitationsPending: number;
  loginAttempts7d: number;
  loginAttemptsOk7d: number;
  loginAttemptsFailed7d: number;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  households: Array<{ id: string; name: string; role: string }>;
};

type Household = {
  id: string;
  name: string;
  ownerEmail: string | null;
  ownerName: string | null;
  createdAt: string;
  memberCount: number;
  choreCount: number;
  eventCount: number;
  familyMemberCount: number;
};

type LoginAttempt = {
  id: string;
  ip: string;
  ok: boolean;
  createdAt: string;
};

type Tab = "overview" | "users" | "households" | "logins";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [households, setHouseholds] = useState<Household[] | null>(null);
  const [logins, setLogins] = useState<LoginAttempt[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden" | "error">("loading");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403 || r.status === 401) {
          setStatus("forbidden");
          return;
        }
        if (!r.ok) {
          setStatus("error");
          return;
        }
        const j = await r.json();
        setOverview(j.overview);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (status !== "ok") return;
    if (tab === "users" && !users) {
      fetch("/api/admin/users", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setUsers(j.users));
    }
    if (tab === "households" && !households) {
      fetch("/api/admin/households", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setHouseholds(j.households));
    }
    if (tab === "logins" && !logins) {
      fetch("/api/admin/logins", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setLogins(j.attempts));
    }
  }, [tab, status, users, households, logins]);

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }
  if (status === "forbidden") {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <Icon name="settings" color="var(--ink-3)" size={48} />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "16px 0 8px" }}>Forbidden</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Your account is not a super admin. Set <code>SUPER_ADMIN_EMAILS</code> on the server to grant access.
          </p>
          <Link href="/" style={{ display: "inline-block", marginTop: 14, color: "var(--terracotta-deep)", fontWeight: 700, textDecoration: "none" }}>
            ← Back home
          </Link>
        </div>
      </main>
    );
  }
  if (status === "error") {
    return <div style={{ padding: 40 }}>Error loading admin.</div>;
  }

  return (
    <main style={{ minHeight: "100vh", padding: "24px 28px", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <span className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08 }}>
            Super admin
          </span>
          <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 800 }}>System dashboard</h1>
        </div>
        <Link href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          <Icon name="back" color="var(--ink-2)" size={14} /> Back to app
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {(["overview", "users", "households", "logins"] as Tab[]).map((t) => {
          const sel = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 99,
                background: sel ? "var(--ink)" : "var(--surface)",
                color: sel ? "white" : "var(--ink-2)",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid var(--line)"
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {tab === "overview" && overview && <OverviewView o={overview} />}
      {tab === "users" && <UsersView users={users} />}
      {tab === "households" && <HouseholdsView households={households} />}
      {tab === "logins" && <LoginsView logins={logins} />}
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <span className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08 }}>
        {label}
      </span>
      <div style={{ fontSize: 32, fontWeight: 900, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function OverviewView({ o }: { o: Overview }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
      <StatCard label="Users" value={o.users} />
      <StatCard label="Households" value={o.households} />
      <StatCard label="Family members" value={o.familyMembers} />
      <StatCard label="Chores" value={o.chores} />
      <StatCard label="Completions" value={o.completions} />
      <StatCard label="Calendar events" value={o.events} />
      <StatCard label="Pending invites" value={o.invitationsPending} />
      <StatCard
        label="Logins (7d)"
        value={o.loginAttempts7d}
        sub={`${o.loginAttemptsOk7d} success · ${o.loginAttemptsFailed7d} failed`}
      />
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function UsersView({ users }: { users: User[] | null }) {
  if (!users) return <p className="muted">Loading users…</p>;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <Table
        headers={["Email", "Name", "Households", "Created", "Last login"]}
        rows={users.map((u) => [
          <span key="e" style={{ fontWeight: 700, wordBreak: "break-all" }}>
            {u.email}
          </span>,
          u.name ?? "—",
          <span key="h" style={{ fontSize: 12 }}>
            {u.households.length === 0
              ? "—"
              : u.households.map((h) => `${h.name} (${h.role})`).join(", ")}
          </span>,
          fmtDate(u.createdAt),
          fmtDate(u.lastLoginAt)
        ])}
      />
    </div>
  );
}

function HouseholdsView({ households }: { households: Household[] | null }) {
  if (!households) return <p className="muted">Loading households…</p>;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <Table
        headers={["Name", "Owner", "Members", "Family", "Chores", "Events", "Created"]}
        rows={households.map((h) => [
          <span key="n" style={{ fontWeight: 700 }}>
            {h.name}
          </span>,
          <span key="o" style={{ fontSize: 12, wordBreak: "break-all" }}>
            {h.ownerEmail ?? "—"}
          </span>,
          String(h.memberCount),
          String(h.familyMemberCount),
          String(h.choreCount),
          String(h.eventCount),
          fmtDate(h.createdAt)
        ])}
      />
    </div>
  );
}

function LoginsView({ logins }: { logins: LoginAttempt[] | null }) {
  if (!logins) return <p className="muted">Loading login attempts…</p>;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <Table
        headers={["Time", "IP", "Result"]}
        rows={logins.map((l) => [
          fmtDate(l.createdAt),
          <code key="ip" style={{ fontSize: 12 }}>
            {l.ip}
          </code>,
          <span
            key="r"
            style={{
              padding: "2px 10px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 800,
              background: l.ok ? "var(--olive-soft)" : "rgba(220,53,53,0.12)",
              color: l.ok ? "var(--olive)" : "var(--danger)"
            }}
          >
            {l.ok ? "ok" : "failed"}
          </span>
        ])}
      />
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.06,
                  color: "var(--ink-3)"
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>
                No data.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                {r.map((cell, j) => (
                  <td key={j} style={{ padding: "10px 14px" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
