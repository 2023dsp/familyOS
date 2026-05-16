"use client";

import { useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { PriorityDots } from "./ChoreRow";
import { ASSIGNEES, CATEGORIES, PRIORITIES, type AssigneeSlug } from "../lib/catalog";
import { formatRecurrence } from "../lib/recurrence";
import { humanDue } from "../lib/date";
import type { ChoreRowData } from "./ChoreRow";

export function ChoreDetailModal({ chore, onClose, onChanged }: { chore: ChoreRowData; onClose: () => void; onChanged: () => void }) {
  const cat = CATEGORIES.find((c) => c.id === chore.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const due = humanDue(chore.dueDate ? new Date(chore.dueDate) : null);
  const recur = chore.isRecurring && chore.recurInterval && chore.recurUnit
    ? formatRecurrence({
        interval: chore.recurInterval,
        unit: chore.recurUnit,
        daysOfWeek: chore.recurDaysOfWeek ? chore.recurDaysOfWeek.split(",") : undefined
      })
    : null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chores/${chore.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: chore.done })
      });
      if (!res.ok) throw new Error("Failed");
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setDue(newDueIso: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chores/${chore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueIso })
      });
      if (!res.ok) throw new Error("Failed");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function localDateInputValue(d: Date | null): string {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function inputToIso(v: string): string | null {
    if (!v) return null;
    const [y, m, d] = v.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 20, 0, 0, 0).toISOString();
  }

  async function postpone() {
    const base = chore.dueDate ? new Date(chore.dueDate) : new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(20, 0, 0, 0);
    await setDue(base.toISOString());
    onClose();
  }

  async function archive() {
    if (!confirm("Archive this chore?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chores/${chore.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reassign(slug: AssigneeSlug) {
    setBusy(true);
    try {
      await fetch(`/api/chores/${chore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeSlug: slug })
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ padding: "24px 24px 20px", background: `linear-gradient(160deg, ${cat?.soft ?? "var(--surface-2)"}, transparent 70%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--surface)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-sm)" }}>
              <Icon name={chore.icon} color={cat?.color ?? "var(--terracotta)"} size={28} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{chore.title}</h2>
              <span className="pill" style={{ background: cat?.soft, color: cat?.color }}>
                <Icon name={cat?.icon ?? "broom"} color={cat?.color ?? "var(--terracotta)"} size={12} />
                {cat?.label ?? chore.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }} aria-label="Close">
            <Icon name="close" color="var(--ink-2)" size={18} />
          </button>
        </div>
      </div>

      <div className="scroll" style={{ padding: "0 24px", maxHeight: 420 }}>
        <DetailRow label="Assigned to" value={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["davide", "luize", "both", "unassigned"] as AssigneeSlug[]).map((a) => {
              const sel = chore.assigneeSlug === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => reassign(a)}
                  disabled={busy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px 4px 4px",
                    borderRadius: 99,
                    background: sel ? "var(--surface-2)" : "transparent",
                    border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  <Avatar who={a} size={20} />
                  {ASSIGNEES[a].name}
                </button>
              );
            })}
          </div>
        } />
        <DetailRow label="Priority" value={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <PriorityDots p={chore.priority} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{PRIORITIES[chore.priority].label}</span>
          </span>
        } />
        <DetailRow
          label="Due"
          value={
            <input
              type="date"
              value={localDateInputValue(chore.dueDate ? new Date(chore.dueDate) : null)}
              onChange={(e) => setDue(inputToIso(e.target.value))}
              disabled={busy}
              style={{
                border: "1.5px solid var(--line-2)",
                background: "var(--surface)",
                color: "var(--ink)",
                padding: "6px 10px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit"
              }}
            />
          }
        />
        <DetailRow label="Repeats" value={recur ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <Icon name="refresh" color="var(--olive)" size={14} /> {recur}
          </span>
        ) : <span className="muted">One-off</span>} />
      </div>

      {error && <div style={{ padding: "0 24px", color: "var(--danger)", fontWeight: 700, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <button className="btn btn-ghost" onClick={postpone} disabled={busy} type="button">
          <Icon name="clock" color="var(--ink-2)" size={16} /> Postpone
        </button>
        <button className="btn btn-ghost" onClick={archive} disabled={busy} style={{ color: "var(--danger)" }} type="button">
          <Icon name="archive" color="var(--danger)" size={16} /> Archive
        </button>
        <button className="btn btn-primary" onClick={toggle} disabled={busy} style={{ flex: 1, minWidth: 200 }} type="button">
          <Icon name="check" color="white" size={18} />
          {chore.done ? "Mark as not done" : "Mark as done"}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--line)", gap: 12 }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, textAlign: "right" }}>{value}</span>
    </div>
  );
}
