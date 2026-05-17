"use client";

import { useEffect, useMemo, useState } from "react";
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

const ADULT_PALETTE = ["#6F8AA8", "#D89AA0", "#3F4B3B", "#A85F40", "#5C4F3F", "#D88A3A"];
const KID_PALETTE = ["#E59A89", "#7AA0C2", "#D9B36C", "#7DA08A", "#B086C2", "#8EB4C9"];

type DraftMode = "adult" | "kid" | null;

export function FamilyMembersCard() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Add form
  const [mode, setMode] = useState<DraftMode>(null);
  const [nName, setNName] = useState("");
  const [nColor, setNColor] = useState<string>(ADULT_PALETTE[0]);

  async function load() {
    const res = await fetch("/api/family-members", { cache: "no-store" });
    if (res.ok) {
      setMembers((await res.json()).members);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("familyos-members-changed"));
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(next: DraftMode) {
    setMode(next);
    setNName("");
    setNColor((next === "kid" ? KID_PALETTE : ADULT_PALETTE)[0]);
    setErr(null);
  }

  async function create() {
    if (!nName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName.trim(), isChild: mode === "kid", color: nColor })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setMode(null);
      setNName("");
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

  async function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Their chores will be reassigned to "Anyone".`)) return;
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

  const real = useMemo(
    () =>
      members?.filter((m) => m.isPerson && m.slug !== "unassigned") ?? null,
    [members]
  );
  const adults = useMemo(() => real?.filter((m) => !m.isChild) ?? [], [real]);
  const kids = useMemo(() => real?.filter((m) => m.isChild) ?? [], [real]);

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="users" color="var(--terracotta)" size={22} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Family members</h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => openForm(mode === "adult" ? null : "adult")}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <Icon name="user" color="var(--ink-2)" size={14} /> Add adult
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => openForm(mode === "kid" ? null : "kid")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              background: "var(--terracotta-soft)",
              color: "var(--terracotta-deep)"
            }}
          >
            <Icon name="star" color="var(--terracotta-deep)" accent="rgba(255,255,255,0.6)" size={14} /> Add kid
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
        Adults can be assigned chores. Kids appear in Kids Mode with their own simplified view. No email needed —
        for email logins use the Invitations card above.
      </p>

      {mode && (
        <div
          style={{
            padding: 14,
            background: "var(--surface-2)",
            borderRadius: 14,
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon
              name={mode === "kid" ? "star" : "user"}
              color={mode === "kid" ? "var(--terracotta)" : "var(--ink-2)"}
              accent={mode === "kid" ? "rgba(255,255,255,0.6)" : undefined}
              size={18}
            />
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {mode === "kid" ? "New kid" : "New adult"}
            </span>
          </div>
          <input
            className="input"
            placeholder={mode === "kid" ? "Kid's name (e.g. Ellie)" : "Name (e.g. Aunt Maria)"}
            value={nName}
            onChange={(e) => setNName(e.target.value)}
            autoFocus
            style={{ fontSize: 14 }}
          />
          <div>
            <span className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.06 }}>
              Color
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {(mode === "kid" ? KID_PALETTE : ADULT_PALETTE).map((c) => {
                const sel = c === nColor;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNColor(c)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      background: c,
                      border: sel ? "3px solid var(--ink)" : "3px solid transparent",
                      cursor: "pointer"
                    }}
                    aria-label={`Pick ${c}`}
                  />
                );
              })}
              <input
                type="color"
                value={nColor}
                onChange={(e) => setNColor(e.target.value)}
                style={{ width: 32, height: 32, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
                aria-label="Custom color"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setMode(null)}
              disabled={busy}
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={create}
              disabled={busy || !nName.trim()}
              style={{ padding: "6px 14px" }}
            >
              <Icon name="check" color="white" size={14} /> Add {mode === "kid" ? "kid" : "adult"}
            </button>
          </div>
        </div>
      )}

      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{err}</div>}

      {!members ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          <SectionHeader label="Adults" count={adults.length} />
          {adults.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, padding: "8px 0" }}>No adults yet.</p>
          ) : (
            <MemberList items={adults} onPatch={patch} onRemove={remove} busy={busy} />
          )}

          <SectionHeader label="Kids" count={kids.length} icon="star" />
          {kids.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--terracotta-soft)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--terracotta-deep)",
                fontWeight: 600
              }}
            >
              No kids yet. Add one to enable Kids Mode.
            </div>
          ) : (
            <MemberList items={kids} onPatch={patch} onRemove={remove} busy={busy} />
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ label, count, icon }: { label: string; count: number; icon?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 6 }}>
      {icon && <Icon name={icon} color="var(--terracotta)" accent="rgba(255,255,255,0.6)" size={14} />}
      <span className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08 }}>
        {label} · {count}
      </span>
    </div>
  );
}

function MemberList({
  items,
  onPatch,
  onRemove,
  busy
}: {
  items: Member[];
  onPatch: (id: string, data: Partial<Member>) => void;
  onRemove: (id: string, name: string) => void;
  busy: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((m) => (
        <div
          key={m.id}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)" }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 99,
              background: m.color,
              color: "white",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 800,
              flexShrink: 0
            }}
          >
            {m.initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {m.isChild ? "Kid" : "Adult"} · {m.slug}
            </div>
          </div>
          <input
            type="color"
            value={m.color}
            onChange={(e) => onPatch(m.id, { color: e.target.value })}
            disabled={busy}
            style={{ width: 28, height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            aria-label="Edit color"
          />
          <button
            type="button"
            onClick={() => onPatch(m.id, { isChild: !m.isChild })}
            disabled={busy}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700 }}
          >
            Mark as {m.isChild ? "adult" : "kid"}
          </button>
          <button
            onClick={() => onRemove(m.id, m.name)}
            disabled={busy}
            type="button"
            className="btn-ghost"
            style={{ padding: 6, color: "var(--danger)" }}
            aria-label="Delete"
          >
            <Icon name="archive" color="var(--danger)" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
