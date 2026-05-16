"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { PriorityDots } from "./ChoreRow";
import { ASSIGNEES, PRIORITIES, type AssigneeSlug, type PriorityKey } from "../lib/catalog";
import { useCategories } from "./CategoriesContext";
import { formatRecurrence } from "../lib/recurrence";
import type { ChoreRowData } from "./ChoreRow";
import type { RecurrenceUnit } from "@prisma/client";

type LocalChore = ChoreRowData & { reminderAt?: string | null };

function localDateInputValue(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function localTimeInputValue(d: Date | null): string {
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function inputDateToIso(v: string): string | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 20, 0, 0, 0).toISOString();
}
function inputDateTimeToIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = (timeStr || "09:00").split(":").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh ?? 9, mm ?? 0, 0, 0).toISOString();
}

const RECUR_PRESETS: Array<{ key: string; label: string; interval: number; unit: RecurrenceUnit | null }> = [
  { key: "none", label: "Once", interval: 0, unit: null },
  { key: "daily", label: "Daily", interval: 1, unit: "day" },
  { key: "weekly", label: "Weekly", interval: 1, unit: "week" },
  { key: "monthly", label: "Monthly", interval: 1, unit: "month" },
  { key: "every-2d", label: "Every 2 days", interval: 2, unit: "day" },
  { key: "every-6m", label: "Every 6 months", interval: 6, unit: "month" }
];

function currentRecurKey(c: LocalChore): string {
  if (!c.isRecurring || !c.recurInterval || !c.recurUnit) return "none";
  const i = c.recurInterval, u = c.recurUnit;
  if (i === 1 && u === "day") return "daily";
  if (i === 1 && u === "week") return "weekly";
  if (i === 1 && u === "month") return "monthly";
  if (i === 2 && u === "day") return "every-2d";
  if (i === 6 && u === "month") return "every-6m";
  return "custom";
}

export function ChoreDetailModal({
  chore: initialChore,
  onClose,
  onChanged
}: {
  chore: ChoreRowData;
  onClose: () => void;
  onChanged: () => void;
}) {
  const categories = useCategories();
  const [chore, setChore] = useState<LocalChore>(initialChore);
  const cat = categories.find((c) => c.id === chore.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChore((prev) => ({ ...prev, ...initialChore }));
  }, [initialChore]);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chores/${chore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const c = json.chore;
      // Mirror server values back into local state so UI stays in sync.
      setChore((prev) => ({
        ...prev,
        priority: c.priority ?? prev.priority,
        important: !!c.important,
        dueDate: c.dueDate ?? null,
        isRecurring: !!c.isRecurring,
        recurInterval: c.recurInterval ?? null,
        recurUnit: c.recurUnit ?? null,
        recurDaysOfWeek: c.recurDaysOfWeek ?? null,
        reminderAt: c.reminderAt ?? null,
        assigneeSlug: ((): AssigneeSlug => {
          const slug = c.assignee?.slug ?? data.assigneeSlug;
          return (["davide", "luize", "both", "unassigned"] as AssigneeSlug[]).includes(slug as AssigneeSlug)
            ? (slug as AssigneeSlug)
            : "unassigned";
        })()
      }));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone() {
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

  async function postpone() {
    const base = chore.dueDate ? new Date(chore.dueDate) : new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(20, 0, 0, 0);
    await patch({ dueDate: base.toISOString() });
  }

  const recurKey = currentRecurKey(chore);
  const dueAsDate = chore.dueDate ? new Date(chore.dueDate) : null;
  const reminderAsDate = chore.reminderAt ? new Date(chore.reminderAt) : null;
  const recurLabel =
    chore.isRecurring && chore.recurInterval && chore.recurUnit
      ? formatRecurrence({
          interval: chore.recurInterval,
          unit: chore.recurUnit,
          daysOfWeek: chore.recurDaysOfWeek ? chore.recurDaysOfWeek.split(",") : undefined
        })
      : null;

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
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => patch({ important: !chore.important })}
              disabled={busy}
              type="button"
              aria-label={chore.important ? "Unpin from important" : "Pin to important"}
              title={chore.important ? "Unpin" : "Pin to important"}
              style={{
                width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center",
                background: chore.important ? "var(--terracotta-soft)" : "rgba(0,0,0,0.04)",
                border: chore.important ? "1.5px solid var(--terracotta)" : "1.5px solid transparent"
              }}
            >
              <Icon name="sparkles" color={chore.important ? "var(--terracotta-deep)" : "var(--ink-3)"} size={16} />
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }} aria-label="Close">
              <Icon name="close" color="var(--ink-2)" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="scroll" style={{ padding: "0 24px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Section label="Assigned to">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["davide", "luize", "both", "unassigned"] as AssigneeSlug[]).map((a) => {
              const sel = chore.assigneeSlug === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => patch({ assigneeSlug: a })}
                  disabled={busy}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px 4px 4px", borderRadius: 99,
                    background: sel ? "var(--surface-2)" : "transparent",
                    border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                    fontWeight: 700, fontSize: 12
                  }}
                >
                  <Avatar who={a} size={20} />
                  {ASSIGNEES[a].name}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Priority">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["low", "medium", "high"] as PriorityKey[]).map((p) => {
              const sel = chore.priority === p;
              const pr = PRIORITIES[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => patch({ priority: p })}
                  disabled={busy}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 99,
                    background: sel ? pr.bg : "rgba(0,0,0,0.04)",
                    border: sel ? `1.5px solid ${pr.color}` : "1.5px solid transparent",
                    fontWeight: 700, fontSize: 12,
                    color: sel ? pr.color : "var(--ink-2)"
                  }}
                >
                  <PriorityDots p={p} />
                  {pr.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Due">
          <input
            type="date"
            value={localDateInputValue(dueAsDate)}
            onChange={(e) => patch({ dueDate: inputDateToIso(e.target.value) })}
            disabled={busy}
            style={{
              border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
              padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
            }}
          />
        </Section>

        <Section label="Repeats">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RECUR_PRESETS.map((r) => {
              const sel = recurKey === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() =>
                    patch({
                      isRecurring: !!r.unit,
                      recurInterval: r.unit ? r.interval : null,
                      recurUnit: r.unit
                    })
                  }
                  disabled={busy}
                  style={{
                    padding: "6px 12px", borderRadius: 99,
                    background: sel ? "var(--olive-soft)" : "rgba(0,0,0,0.04)",
                    border: sel ? "1.5px solid var(--olive)" : "1.5px solid transparent",
                    fontWeight: 700, fontSize: 12,
                    color: sel ? "var(--olive)" : "var(--ink-2)"
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {recurLabel && recurKey === "custom" && (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{recurLabel}</div>
          )}
        </Section>

        <ReminderEditor
          chore={chore}
          busy={busy}
          dueAsDate={dueAsDate}
          reminderAsDate={reminderAsDate}
          onPatch={patch}
        />
      </div>

      {error && <div style={{ padding: "8px 24px 0", color: "var(--danger)", fontWeight: 700, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <button className="btn btn-ghost" onClick={postpone} disabled={busy} type="button">
          <Icon name="clock" color="var(--ink-2)" size={16} /> Postpone
        </button>
        <button className="btn btn-ghost" onClick={archive} disabled={busy} style={{ color: "var(--danger)" }} type="button">
          <Icon name="archive" color="var(--danger)" size={16} /> Archive
        </button>
        <button className="btn btn-primary" onClick={toggleDone} disabled={busy} style={{ flex: 1, minWidth: 200 }} type="button">
          <Icon name="check" color="white" size={18} />
          {chore.done ? "Mark as not done" : "Mark as done"}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 0", borderTop: "1px solid var(--line)" }}>
      <span className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>{label}</span>
      {children}
    </div>
  );
}

function ReminderEditor({
  chore,
  busy,
  dueAsDate,
  reminderAsDate,
  onPatch
}: {
  chore: LocalChore;
  busy: boolean;
  dueAsDate: Date | null;
  reminderAsDate: Date | null;
  onPatch: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(
    localDateInputValue(reminderAsDate ?? dueAsDate ?? new Date())
  );
  const [time, setTime] = useState(
    reminderAsDate ? localTimeInputValue(reminderAsDate) : "09:00"
  );

  function startEdit() {
    setDate(localDateInputValue(reminderAsDate ?? dueAsDate ?? new Date()));
    setTime(reminderAsDate ? localTimeInputValue(reminderAsDate) : "09:00");
    setEditing(true);
  }

  async function save() {
    const iso = inputDateTimeToIso(date, time);
    if (!iso) return;
    await onPatch({ reminderAt: iso });
    setEditing(false);
  }

  async function clear() {
    await onPatch({ reminderAt: null });
    setEditing(false);
  }

  const reminderLabel = reminderAsDate
    ? `${reminderAsDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${reminderAsDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : null;

  return (
    <Section label="Reminder">
      {!editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {reminderLabel ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
              <Icon name="clock" color="var(--terracotta)" size={14} /> {reminderLabel}
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>None</span>
          )}
          <button
            type="button"
            onClick={startEdit}
            disabled={busy}
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            <Icon name="clock" color="var(--ink-2)" size={14} /> {reminderLabel ? "Edit" : "Set reminder"}
          </button>
          {reminderLabel && (
            <button type="button" onClick={clear} disabled={busy} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, color: "var(--danger)" }}>
              Clear
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
            style={{
              border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
              padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
            }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={busy}
            style={{
              border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
              padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
            }}
          />
          <button className="btn btn-primary" type="button" onClick={save} disabled={busy} style={{ padding: "6px 14px" }}>
            <Icon name="check" color="white" size={14} /> Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)} disabled={busy} style={{ padding: "6px 12px", fontSize: 12 }}>
            Cancel
          </button>
        </div>
      )}
    </Section>
  );
}
