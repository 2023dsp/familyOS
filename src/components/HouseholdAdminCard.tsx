"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Household = { id: string; name: string };
type Invite = {
  id: string;
  email: string;
  role: "admin" | "member" | "child";
  expiresAt: string;
  createdAt: string;
  token: string;
};

export function HouseholdAdminCard() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    const res = await fetch("/api/household", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      setHousehold(j.household);
      setDraft(j.household.name);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/household", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() })
      });
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const j = await res.json();
      setHousehold(j.household);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="home" color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Household</h3>
      </div>

      {denied && (
        <p className="muted" style={{ fontSize: 13 }}>
          Only owners and admins can rename the household.
        </p>
      )}

      {!household ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : editing ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Household name"
            disabled={busy}
            style={{ flex: 1, minWidth: 200, fontSize: 14 }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={save}
            disabled={busy || !draft.trim() || draft.trim() === household.name}
          >
            <Icon name="check" color="white" size={14} /> Save
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setDraft(household.name);
              setEditing(false);
              setErr(null);
            }}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{household.name}</div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setEditing(true)}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <Icon name="settings" color="var(--ink-2)" size={14} /> Rename
          </button>
        </div>
      )}
      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export function InvitesCard() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Invite["role"]>("member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    const res = await fetch("/api/invitations", { cache: "no-store" });
    if (res.status === 403) {
      setDenied(true);
      return;
    }
    if (res.ok) setInvites((await res.json()).invitations);
  }

  useEffect(() => {
    load();
  }, []);

  async function send() {
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed");
      const acceptUrl: string | undefined = j.invitation?.acceptUrl;
      if (j.emailSent) {
        setInfo(`Invitation sent to ${email}.`);
      } else {
        setInfo(
          `Invitation created but email failed (${j.emailError ?? "unknown"}). Share this link: ${acceptUrl ?? ""}`
        );
      }
      setEmail("");
      setOpen(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    setBusy(true);
    try {
      await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setInfo("Link copied to clipboard.");
    } catch {
      setInfo(url);
    }
  }

  if (denied) {
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Icon name="link" color="var(--terracotta)" size={22} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Invitations</h3>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Only owners and admins can invite new members.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="link" color="var(--terracotta)" size={22} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Invitations</h3>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ padding: "6px 12px", fontSize: 13 }}
        >
          <Icon name="plus" color="var(--ink-2)" size={14} /> Invite
        </button>
      </div>

      {open && (
        <div
          style={{
            padding: 12,
            background: "var(--surface-2)",
            borderRadius: 14,
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          <input
            className="input"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            style={{ fontSize: 14 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Role:</span>
            {(["member", "admin", "child"] as Invite["role"][]).map((r) => {
              const sel = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 99,
                    background: sel ? "var(--surface)" : "rgba(0,0,0,0.04)",
                    border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  {r}
                </button>
              );
            })}
            <button
              className="btn btn-primary"
              type="button"
              onClick={send}
              disabled={busy || !email.trim()}
              style={{ marginLeft: "auto" }}
            >
              <Icon name="check" color="white" size={14} /> Send
            </button>
          </div>
        </div>
      )}

      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{err}</div>}
      {info && (
        <div
          style={{
            color: "var(--olive)",
            background: "var(--olive-soft)",
            padding: "8px 12px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 8,
            wordBreak: "break-all"
          }}
        >
          {info}
        </div>
      )}

      {!invites ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : invites.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No pending invitations.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {invites.map((i) => {
            const exp = new Date(i.expiresAt);
            return (
              <div
                key={i.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderTop: "1px solid var(--line)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-all" }}>{i.email}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {i.role} · expires {exp.toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(i.token)}
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  disabled={busy}
                  className="btn-ghost"
                  style={{ padding: 6, color: "var(--danger)" }}
                  aria-label="Revoke"
                >
                  <Icon name="archive" color="var(--danger)" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
