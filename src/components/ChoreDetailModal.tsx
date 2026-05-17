"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { PriorityDots } from "./ChoreRow";
import { PRIORITIES, type AssigneeSlug, type PriorityKey } from "../lib/catalog";
import { useCategories } from "./CategoriesContext";
import { useAssignableMembers } from "./FamilyMembersContext";
// categories used in detail modal for editable category section
import { formatRecurrence } from "../lib/recurrence";
import type { ChoreRowData } from "./ChoreRow";
import type { RecurrenceUnit } from "@prisma/client";

type LocalChore = ChoreRowData & { reminderAt?: string | null; notes?: string | null };

const ICON_PICK = ["broom", "dishes", "trash", "plant", "drop", "bulb", "cart", "car", "sofa", "card", "book", "tools"];
const WEEK_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" }
];

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
  const members = useAssignableMembers();
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
        title: c.title ?? prev.title,
        icon: c.icon ?? prev.icon,
        category: c.category ?? prev.category,
        notes: c.notes ?? null,
        priority: c.priority ?? prev.priority,
        important: !!c.important,
        dueDate: c.dueDate ?? null,
        isRecurring: !!c.isRecurring,
        recurInterval: c.recurInterval ?? null,
        recurUnit: c.recurUnit ?? null,
        recurDaysOfWeek: c.recurDaysOfWeek ?? null,
        reminderAt: c.reminderAt ?? null,
        assigneeSlug: ((): AssigneeSlug => {
          const slug = c.assignee?.slug ?? (typeof data.assigneeSlug === "string" ? data.assigneeSlug : null);
          return slug ?? "unassigned";
        })(),
        assigneeSlugs: ((): string[] => {
          if (Array.isArray(c.assignees) && c.assignees.length > 0) {
            return c.assignees
              .map((a: { member?: { slug?: string | null } | null }) => a.member?.slug)
              .filter((s: string | null | undefined): s is string => !!s);
          }
          if (Array.isArray(data.assigneeSlugs)) return data.assigneeSlugs as string[];
          return prev.assigneeSlugs ?? [];
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

  async function snooze(minutes: number) {
    const base = chore.dueDate ? new Date(chore.dueDate) : new Date();
    base.setMinutes(base.getMinutes() + minutes);
    await patch({ dueDate: base.toISOString() });
  }

  async function snoozeTomorrow() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    await patch({ dueDate: t.toISOString() });
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <EditableTitle value={chore.title} disabled={busy} onSave={(v) => patch({ title: v })} />
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
            {members.map((m) => {
              const current = chore.assigneeSlugs ?? (chore.assigneeSlug && chore.assigneeSlug !== "unassigned" ? [chore.assigneeSlug] : []);
              const sel = current.includes(m.slug);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const next = sel ? current.filter((s) => s !== m.slug) : [...current, m.slug];
                    patch({ assigneeSlugs: next });
                  }}
                  disabled={busy}
                  aria-pressed={sel}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px 4px 4px", borderRadius: 99,
                    background: sel ? "var(--surface-2)" : "transparent",
                    border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                    fontWeight: 700, fontSize: 12
                  }}
                >
                  <Avatar who={m.slug} size={20} />
                  {m.name}
                  {sel && <Icon name="check" color="var(--ink)" size={10} />}
                </button>
              );
            })}
            {members.length === 0 && (
              <span className="muted" style={{ fontSize: 12 }}>No members yet</span>
            )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="date"
              value={localDateInputValue(dueAsDate)}
              onChange={(e) => patch({ dueDate: inputDateToIso(e.target.value) })}
              disabled={busy}
              style={{
                border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                alignSelf: "flex-start"
              }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <SnoozeBtn label="+1h" onClick={() => snooze(60)} disabled={busy} />
              <SnoozeBtn label="+3h" onClick={() => snooze(180)} disabled={busy} />
              <SnoozeBtn label="Tomorrow" onClick={() => snoozeTomorrow()} disabled={busy} />
              <SnoozeBtn label="Next week" onClick={() => snooze(60 * 24 * 7)} disabled={busy} />
            </div>
          </div>
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
          {chore.isRecurring && chore.recurUnit === "week" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <span style={{ color: "var(--ink-3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>On these days</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {WEEK_DAYS.map((d) => {
                  const days = (chore.recurDaysOfWeek ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                  const sel = days.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        const next = sel ? days.filter((x) => x !== d.key) : [...days, d.key];
                        patch({ recurDaysOfWeek: next.join(",") || null });
                      }}
                      disabled={busy}
                      style={{
                        width: 42, height: 32, borderRadius: 10,
                        background: sel ? "var(--olive)" : "var(--surface-2)",
                        color: sel ? "white" : "var(--ink-2)",
                        fontWeight: 800, fontSize: 11
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <ReminderEditor
          chore={chore}
          busy={busy}
          dueAsDate={dueAsDate}
          reminderAsDate={reminderAsDate}
          onPatch={patch}
        />

        <Section label="Icon">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ICON_PICK.map((n) => (
              <button
                key={n}
                onClick={() => patch({ icon: n })}
                type="button"
                disabled={busy}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: chore.icon === n ? "var(--terracotta-soft)" : "var(--surface-2)",
                  border: chore.icon === n ? "1.5px solid var(--terracotta)" : "1.5px solid transparent",
                  display: "grid", placeItems: "center"
                }}
              >
                <Icon name={n} color={chore.icon === n ? "var(--terracotta-deep)" : "var(--ink-2)"} size={18} />
              </button>
            ))}
          </div>
        </Section>

        <Section label="Category">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {categories.map((c) => {
              const sel = chore.category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => patch({ category: c.id })}
                  type="button"
                  disabled={busy}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 99,
                    background: sel ? c.soft : "rgba(0,0,0,0.04)",
                    border: sel ? `1.5px solid ${c.color}` : "1.5px solid transparent",
                    fontWeight: 700, fontSize: 12,
                    color: sel ? c.color : "var(--ink-2)"
                  }}
                >
                  <Icon name={c.icon} color={sel ? c.color : "var(--ink-3)"} size={12} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Notes">
          <EditableNotes value={chore.notes ?? ""} disabled={busy} onSave={(v) => patch({ notes: v || null })} />
        </Section>
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

function EditableTitle({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !disabled && setEditing(true)}
        disabled={disabled}
        style={{
          all: "unset",
          cursor: disabled ? "default" : "text",
          display: "block",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1.2,
          wordBreak: "break-word",
          width: "100%"
        }}
      >
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (v && v !== value) onSave(v);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      style={{
        border: "1.5px solid var(--terracotta)",
        background: "var(--surface)",
        color: "var(--ink)",
        padding: "4px 8px",
        borderRadius: 10,
        fontSize: 20,
        fontWeight: 800,
        fontFamily: "inherit",
        width: "100%"
      }}
    />
  );
}

function EditableNotes({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        className="input"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        placeholder="Anything else worth remembering"
        disabled={disabled}
        style={{ minHeight: 64, fontSize: 13, resize: "vertical", paddingTop: 10 }}
      />
      {dirty && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled}
            onClick={() => {
              onSave(draft.trim());
              setDirty(false);
            }}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled}
            onClick={() => {
              setDraft(value);
              setDirty(false);
            }}
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SnoozeBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 99,
        background: "rgba(0,0,0,0.04)",
        fontWeight: 700,
        fontSize: 11,
        color: "var(--ink-2)",
        border: "1.5px solid transparent"
      }}
    >
      <Icon name="clock" color="var(--ink-3)" size={12} /> {label}
    </button>
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
  dueAsDate
}: {
  chore: LocalChore;
  busy: boolean;
  dueAsDate: Date | null;
  reminderAsDate: Date | null;
  onPatch: (d: Record<string, unknown>) => Promise<void>;
}) {
  type Reminder = { id: string; scheduledAt: string; sentAt: string | null };
  const [list, setList] = useState<Reminder[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(localDateInputValue(dueAsDate ?? new Date()));
  const [time, setTime] = useState("09:00");
  const [localBusy, setLocalBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/chores/${chore.id}/reminders`, { cache: "no-store" });
      if (res.ok) setList((await res.json()).reminders);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chore.id]);

  async function add() {
    const iso = inputDateTimeToIso(date, time);
    if (!iso) return;
    setLocalBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chores/${chore.id}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: iso })
      });
      if (!res.ok) throw new Error("Failed to add reminder");
      setAdding(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLocalBusy(false);
    }
  }

  async function remove(id: string) {
    setLocalBusy(true);
    try {
      await fetch(`/api/chores/${chore.id}/reminders/${id}`, { method: "DELETE" });
      load();
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <Section label="Reminders">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list === null && <span className="muted" style={{ fontSize: 12 }}>Loading…</span>}
        {list?.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No reminders set.</span>}
        {list?.map((r) => {
          const d = new Date(r.scheduledAt);
          const timeLabel = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
          const label = chore.isRecurring
            ? `${timeLabel} · every occurrence`
            : `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${timeLabel}`;
          const sent = !!r.sentAt;
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 12,
                background: sent ? "rgba(0,0,0,0.04)" : "var(--terracotta-soft)",
                color: sent ? "var(--ink-3)" : "var(--terracotta-deep)"
              }}
            >
              <Icon name="clock" color={sent ? "var(--ink-3)" : "var(--terracotta)"} size={14} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{label}</span>
              {sent && <span style={{ fontSize: 11, fontWeight: 700 }}>sent</span>}
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={busy || localBusy}
                aria-label="Delete reminder"
                style={{ padding: 4, borderRadius: 8, color: "var(--danger)" }}
              >
                <Icon name="archive" color="var(--danger)" size={14} />
              </button>
            </div>
          );
        })}

        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setDate(localDateInputValue(dueAsDate ?? new Date()));
              setTime("09:00");
              setAdding(true);
            }}
            disabled={busy || localBusy}
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 12, alignSelf: "flex-start" }}
          >
            <Icon name="plus" color="var(--ink-2)" size={14} /> Add reminder
          </button>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: 8, background: "var(--surface-2)", borderRadius: 12 }}>
            {!chore.isRecurring && (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={localBusy}
                style={{
                  border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                  padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
                }}
              />
            )}
            {chore.isRecurring && (
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                On every occurrence at
              </span>
            )}
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={localBusy}
              style={{
                border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
              }}
            />
            <button className="btn btn-primary" type="button" onClick={add} disabled={localBusy} style={{ padding: "6px 14px" }}>
              <Icon name="check" color="white" size={14} /> Save
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setAdding(false)} disabled={localBusy} style={{ padding: "6px 12px", fontSize: 12 }}>
              Cancel
            </button>
          </div>
        )}
        {err && <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700 }}>{err}</span>}
      </div>
    </Section>
  );
}
