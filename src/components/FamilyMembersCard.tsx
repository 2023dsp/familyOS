"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Member = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  color: string;
  isChild: boolean;
  isPerson: boolean;
};

export function FamilyMembersCard() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New form
  const [open, setOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nChild, setNChild] = useState(false);
  const [nColor, setNColor] = useState("#6F8AA8");

  async function load() {
    const res = await fetch("/api/family-members", { cache: "no-store" });
    if (res.ok) setMembers((await res.json()).members);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nName) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName, isChild: nChild, color: nColor })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setNName("");
      setNChild(false);
      setOpen(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, data: Partial<Member>) {
    setBusy(true);
    try {
      await fetch(`/api/family-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this member? Their chores will be re-assigned to Anyone.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/family-members/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const real = members?.filter((m) => m.slug !== "both" && m.slug !== "unassigned") ?? null;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="users" color="var(--terracotta)" size={22} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Family members</h3>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ padding: "6px 12px", fontSize: 13 }}
        >
          <Icon name="plus" color="var(--ink-2)" size={14} /> Add
        </button>
      </div>

      {open && (
        <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="input"
            placeholder="Name (e.g. Ellie)"
            value={nName}
            onChange={(e) => setNName(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={nChild} onChange={(e) => setNChild(e.target.checked)} />
              Child
            </label>
            <input type="color" value={nColor} onChange={(e) => setNColor(e.target.value)} style={{ width: 36, height: 30, border: "none", padding: 0, background: "transparent", cursor: "pointer" }} />
            <button className="btn btn-primary" type="button" onClick={create} disabled={busy || !nName} style={{ marginLeft: "auto" }}>
              <Icon name="check" color="white" size={14} /> Add
            </button>
          </div>
        </div>
      )}

      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{err}</div>}

      {!members ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : real && real.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No members yet. Add yourself to start.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {real?.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ width: 36, height: 36, borderRadius: 99, background: m.color, color: "white", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>
                {m.initials}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {m.isChild ? "Child" : "Adult"} · {m.slug}
                </div>
              </div>
              <input
                type="color"
                value={m.color}
                onChange={(e) => patch(m.id, { color: e.target.value })}
                disabled={busy}
                style={{ width: 28, height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
                aria-label="Edit color"
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>
                <input
                  type="checkbox"
                  checked={m.isChild}
                  onChange={(e) => patch(m.id, { isChild: e.target.checked })}
                  disabled={busy}
                />
                kid
              </label>
              <button onClick={() => remove(m.id)} disabled={busy} type="button" className="btn-ghost" style={{ padding: 6, color: "var(--danger)" }} aria-label="Delete">
                <Icon name="archive" color="var(--danger)" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
