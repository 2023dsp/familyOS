"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Segmented } from "./Segmented";
import { type PriorityKey } from "../lib/catalog";
import { useCategories } from "./CategoriesContext";
import { useAssignableMembers } from "./FamilyMembersContext";
import type { Suggestion } from "../lib/suggest";
import type { RecurrenceUnit } from "@prisma/client";

const ICON_PICK = ["broom", "dishes", "trash", "plant", "drop", "bulb", "cart", "car", "sofa", "card", "book", "tools"];

function toLocalDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function quickDate(kind: "today" | "tomorrow" | "weekend"): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (kind === "tomorrow") d.setDate(d.getDate() + 1);
  else if (kind === "weekend") {
    const wantSat = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + wantSat);
  }
  return toLocalDateInputValue(d);
}

function dueInputToIso(v: string): string | null {
  if (!v) return null;
  const [y, m, day] = v.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day, 20, 0, 0, 0);
  return d.toISOString();
}

function reminderInputToIso(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = (time || "09:00").split(":").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh ?? 9, mm ?? 0, 0, 0).toISOString();
}

export type AddChorePrefill = {
  title?: string;
  icon?: string;
  category?: string;
  priority?: PriorityKey;
  recurInterval?: number;
  recurUnit?: RecurrenceUnit;
};

type PendingReminder = { id: string; iso: string };

export function AddChoreModal({
  onClose,
  onSaved,
  prefill
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: AddChorePrefill;
}) {
  const categories = useCategories();
  const members = useAssignableMembers();
  const [text, setText] = useState(prefill?.title ?? "");
  const [icon, setIcon] = useState(prefill?.icon ?? "broom");
  const [category, setCategory] = useState(prefill?.category ?? "cleaning");
  const [assignees, setAssignees] = useState<string[]>([]);
  const toggleAssignee = (slug: string) =>
    setAssignees((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  const [priority, setPriority] = useState<PriorityKey>(prefill?.priority ?? "medium");
  const [due, setDue] = useState<string>(quickDate("today"));
  const [recurInterval, setRecurInterval] = useState<number | null>(prefill?.recurInterval ?? null);
  const [recurUnit, setRecurUnit] = useState<RecurrenceUnit | null>(prefill?.recurUnit ?? null);
  const [recurringEnabled, setRecurringEnabled] = useState<boolean>(
    prefill?.recurInterval != null && prefill?.recurUnit != null
  );
  const [notes, setNotes] = useState("");
  const [important, setImportant] = useState(false);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [addingReminder, setAddingReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(quickDate("today"));
  const [reminderTime, setReminderTime] = useState("09:00");
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [suggestion, setSuggestion] = useState<Suggestion>({});
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    if (!text || text.trim().length < 3) {
      setSuggestion({});
      return;
    }
    setSuggestLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text })
        });
        if (res.ok) {
          const j = await res.json();
          setSuggestion(j.suggestion ?? {});
        }
      } catch {
        /* aborted or network */
      } finally {
        setSuggestLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  const accept = (k: keyof Suggestion) => {
    const v = suggestion[k];
    if (k === "icon" && typeof v === "string") setIcon(v);
    if (k === "category" && typeof v === "string") setCategory(v);
    if (k === "priority" && (v === "low" || v === "medium" || v === "high")) setPriority(v);
    if (k === "recurInterval" && typeof v === "number") {
      setRecurInterval(v);
      setRecurringEnabled(true);
    }
    if (k === "recurUnit" && typeof v === "string") {
      setRecurUnit(v as RecurrenceUnit);
      setRecurringEnabled(true);
    }
    if (k === "dueHint") {
      if (v === "today") setDue(quickDate("today"));
      else if (v === "tomorrow") setDue(quickDate("tomorrow"));
      else if (v === "weekend") setDue(quickDate("weekend"));
    }
    setDismissed((d) => ({ ...d, [k]: true }));
  };

  const cleanTitle = suggestion.cleanTitle || text.trim();
  const hasRecur = recurringEnabled && recurInterval != null && recurUnit != null;

  const recurChoices: Array<{ key: string; label: string; interval: number; unit: RecurrenceUnit | null }> = [
    { key: "daily", label: "Daily", interval: 1, unit: "day" },
    { key: "weekly", label: "Weekly", interval: 1, unit: "week" },
    { key: "monthly", label: "Monthly", interval: 1, unit: "month" },
    { key: "every-2d", label: "Every 2 days", interval: 2, unit: "day" },
    { key: "every-6m", label: "Every 6 months", interval: 6, unit: "month" }
  ];
  const recurKey =
    recurInterval === 1 && recurUnit === "day" ? "daily" :
    recurInterval === 1 && recurUnit === "week" ? "weekly" :
    recurInterval === 1 && recurUnit === "month" ? "monthly" :
    recurInterval === 2 && recurUnit === "day" ? "every-2d" :
    recurInterval === 6 && recurUnit === "month" ? "every-6m" : "";

  function addReminder() {
    const iso = reminderInputToIso(reminderDate, reminderTime);
    if (!iso) return;
    setPendingReminders((rs) => [...rs, { id: `pending-${Date.now()}`, iso }]);
    setAddingReminder(false);
    setReminderTime("09:00");
  }

  function removeReminder(id: string) {
    setPendingReminders((rs) => rs.filter((r) => r.id !== id));
  }

  async function save() {
    if (!cleanTitle) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          notes: notes.trim() || null,
          icon,
          category,
          priority,
          assigneeSlugs: assignees,
          dueDate: dueInputToIso(due),
          isRecurring: hasRecur,
          recurInterval: hasRecur ? recurInterval ?? undefined : undefined,
          recurUnit: hasRecur ? recurUnit ?? undefined : undefined,
          important
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to save");
      }
      const { chore } = await res.json();
      // Persist pending reminders against the new chore id
      await Promise.all(
        pendingReminders.map((r) =>
          fetch(`/api/chores/${chore.id}/reminders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledAt: r.iso })
          })
        )
      );
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 8px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Add a chore</h2>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>Type it like you&apos;d say it — we&apos;ll fill the rest in.</p>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }} aria-label="Close">
          <Icon name="close" color="var(--ink-2)" size={18} />
        </button>
      </div>

      <div className="scroll" style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 18, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Title */}
        <div style={{ position: "relative" }}>
          <input
            className="input"
            placeholder='Try: "clean garden Saturday" or "change tires every 6 months"'
            value={text}
            onChange={(e) => { setText(e.target.value); setDismissed({}); }}
            style={{ paddingLeft: 44, paddingRight: 50, fontSize: 16 }}
          />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
            <Icon name="sparkles" color="var(--terracotta)" size={20} />
          </span>
          <VoiceButton onResult={(t) => { setText((prev) => (prev ? prev + " " : "") + t); setDismissed({}); }} />
        </div>

        {(suggestLoading || suggestion.icon || suggestion.category || suggestion.recurInterval || suggestion.priority || suggestion.dueHint) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.06 }}>
              {suggestLoading ? "Thinking…" : "Suggested"}
            </span>
            {suggestion.icon && !dismissed.icon && (
              <AIChip label={`Icon: ${suggestion.icon}`} onClick={() => accept("icon")} />
            )}
            {suggestion.category && !dismissed.category && (
              <AIChip label={`Category: ${suggestion.category}`} onClick={() => accept("category")} />
            )}
            {suggestion.recurInterval && suggestion.recurUnit && !dismissed.recurInterval && (
              <AIChip
                label={`Repeat: every ${suggestion.recurInterval} ${suggestion.recurUnit}${suggestion.recurInterval > 1 ? "s" : ""}`}
                onClick={() => {
                  accept("recurInterval");
                  accept("recurUnit");
                }}
              />
            )}
            {suggestion.priority && !dismissed.priority && (
              <AIChip label={`Priority: ${suggestion.priority}`} onClick={() => accept("priority")} />
            )}
            {suggestion.dueHint && !dismissed.dueHint && (
              <AIChip label={`Due: ${suggestion.dueHint}`} onClick={() => accept("dueHint")} />
            )}
          </div>
        )}

        {/* Deadline */}
        <Section label="Deadline">
          <DueDatePicker value={due} onChange={setDue} />
        </Section>

        {/* Reminders */}
        <Section label="Reminders">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingReminders.length === 0 && !addingReminder && (
              <span className="muted" style={{ fontSize: 13 }}>No reminders set.</span>
            )}
            {pendingReminders.map((r) => {
              const d = new Date(r.iso);
              const label = `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: "var(--terracotta-soft)",
                    color: "var(--terracotta-deep)"
                  }}
                >
                  <Icon name="clock" color="var(--terracotta)" size={14} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{label}</span>
                  <button
                    type="button"
                    onClick={() => removeReminder(r.id)}
                    aria-label="Remove reminder"
                    style={{ padding: 4, borderRadius: 8, color: "var(--danger)" }}
                  >
                    <Icon name="archive" color="var(--danger)" size={14} />
                  </button>
                </div>
              );
            })}

            {!addingReminder ? (
              <button
                type="button"
                onClick={() => {
                  setReminderDate(due || quickDate("today"));
                  setReminderTime("09:00");
                  setAddingReminder(true);
                }}
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: 12, alignSelf: "flex-start" }}
              >
                <Icon name="plus" color="var(--ink-2)" size={14} /> Add reminder
              </button>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: 8, background: "var(--surface-2)", borderRadius: 12 }}>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  style={{
                    border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                    padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
                  }}
                />
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  style={{
                    border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                    padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
                  }}
                />
                <button className="btn btn-primary" type="button" onClick={addReminder} style={{ padding: "6px 14px" }}>
                  <Icon name="check" color="white" size={14} /> Add
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setAddingReminder(false)} style={{ padding: "6px 12px", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Assignees (multi-select) */}
        <Section label="Assignees">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {members.map((m) => {
              const sel = assignees.includes(m.slug);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAssignee(m.slug)}
                  type="button"
                  aria-pressed={sel}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 14px 8px 8px",
                    borderRadius: 99,
                    background: sel ? "var(--surface-2)" : "rgba(0,0,0,0.04)",
                    border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                    fontWeight: 700,
                    fontSize: 13
                  }}
                >
                  <Avatar who={m.slug} size={26} />
                  {m.name}
                  {sel && <Icon name="check" color="var(--ink)" size={12} />}
                </button>
              );
            })}
            {members.length === 0 && (
              <span className="muted" style={{ fontSize: 12 }}>No members yet. Add some in Settings → Household.</span>
            )}
          </div>
          {assignees.length === 0 && members.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>Tap a member to assign. Leave empty for unassigned.</span>
          )}
        </Section>

        <Section label="Priority">
          <Segmented<PriorityKey>
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" }
            ]}
          />
        </Section>

        {/* Recurrence toggle + presets */}
        <Section label="Repeats">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle
              on={recurringEnabled}
              onChange={(v) => {
                setRecurringEnabled(v);
                if (v && !recurUnit) {
                  setRecurInterval(1);
                  setRecurUnit("week");
                }
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {recurringEnabled ? "Recurring" : "One-off"}
            </span>
          </div>
          {recurringEnabled && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {recurChoices.map((r) => {
                const sel = recurKey === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => {
                      setRecurInterval(r.interval);
                      setRecurUnit(r.unit);
                    }}
                    type="button"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 99,
                      background: sel ? "var(--olive-soft)" : "rgba(0,0,0,0.04)",
                      border: sel ? "1.5px solid var(--olive)" : "1.5px solid transparent",
                      fontWeight: 700,
                      fontSize: 13,
                      color: sel ? "var(--olive)" : "var(--ink-2)"
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Icon + Category (visual stuff at the bottom) */}
        <Section label="Icon">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {ICON_PICK.map((n) => (
              <button
                key={n}
                onClick={() => setIcon(n)}
                type="button"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: icon === n ? "var(--terracotta-soft)" : "var(--surface-2)",
                  border: icon === n ? "1.5px solid var(--terracotta)" : "1.5px solid transparent",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                <Icon name={n} color={icon === n ? "var(--terracotta-deep)" : "var(--ink-2)"} size={22} />
              </button>
            ))}
          </div>
        </Section>

        <Section label="Category">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((c) => {
              const sel = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 99,
                    background: sel ? c.soft : "rgba(0,0,0,0.04)",
                    border: sel ? `1.5px solid ${c.color}` : "1.5px solid transparent",
                    fontWeight: 700,
                    fontSize: 13,
                    color: sel ? c.color : "var(--ink-2)"
                  }}
                >
                  <Icon name={c.icon} color={sel ? c.color : "var(--ink-3)"} size={14} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Pin to important">
          <button
            type="button"
            onClick={() => setImportant((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 14,
              background: important ? "var(--terracotta-soft)" : "rgba(0,0,0,0.04)",
              border: important ? "1.5px solid var(--terracotta)" : "1.5px solid transparent",
              color: important ? "var(--terracotta-deep)" : "var(--ink-2)",
              fontWeight: 700,
              fontSize: 13,
              alignSelf: "flex-start"
            }}
          >
            <Icon name="sparkles" color={important ? "var(--terracotta-deep)" : "var(--ink-3)"} size={16} />
            {important ? "Pinned" : "Pin to important"}
          </button>
        </Section>

        <Section label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else worth remembering"
            className="input"
            style={{ minHeight: 64, fontSize: 14, resize: "none", paddingTop: 12 }}
          />
        </Section>

        {err && <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 13 }}>{err}</div>}
      </div>

      <div style={{ display: "flex", gap: 12, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <button className="btn btn-ghost" onClick={onClose} style={{ flex: 0.4 }} type="button">
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving || !cleanTitle} style={{ flex: 1 }} type="button">
          <Icon name="check" color="white" size={18} />
          {saving ? "Saving…" : "Add chore"}
        </button>
      </div>
    </ModalBackdrop>
  );
}

function Section({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>{label}</span>
      {children}
    </div>
  );
}

function DueDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = quickDate("today");
  const tomorrow = quickDate("tomorrow");
  const weekend = quickDate("weekend");
  const options: Array<{ key: string; label: string; v: string }> = [
    { key: "none", label: "None", v: "" },
    { key: "today", label: "Today", v: today },
    { key: "tomorrow", label: "Tomorrow", v: tomorrow },
    { key: "weekend", label: "Weekend", v: weekend }
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const sel = value === o.v;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.v)}
              style={{
                padding: "8px 14px",
                borderRadius: 99,
                background: sel ? "var(--surface-2)" : "rgba(0,0,0,0.04)",
                border: sel ? "1.5px solid var(--ink-2)" : "1.5px solid transparent",
                fontWeight: 700,
                fontSize: 13,
                color: sel ? "var(--ink)" : "var(--ink-2)"
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <input
        type="date"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 14, padding: "10px 14px" }}
      />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 44, height: 26, borderRadius: 99, padding: 3,
        background: on ? "var(--olive)" : "rgba(0,0,0,0.12)",
        transition: "background 0.18s"
      }}
    >
      <span
        style={{
          display: "block", width: 20, height: 20, borderRadius: 99, background: "white",
          transform: `translateX(${on ? 18 : 0}px)`,
          transition: "transform 0.18s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        }}
      />
    </button>
  );
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function VoiceButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recogRef = useState<SpeechRecognitionLike | null>(null);
  useEffect(() => {
    setSupported(getSpeechCtor() !== null);
  }, []);
  if (!supported) return null;

  function start() {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "it-IT";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (ev) => {
      const t = ev.results?.[0]?.[0]?.transcript ?? "";
      if (t) onResult(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recogRef[1](r);
    setListening(true);
  }

  function stop() {
    recogRef[0]?.stop();
    setListening(false);
  }

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Stop voice input" : "Voice input"}
      title="Voice input"
      style={{
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        width: 36,
        height: 36,
        borderRadius: 99,
        background: listening ? "var(--terracotta)" : "rgba(0,0,0,0.04)",
        display: "grid",
        placeItems: "center",
        animation: listening ? "pulseSoft 1.2s ease-in-out infinite" : undefined
      }}
    >
      <Icon name="mic" color={listening ? "white" : "var(--ink-3)"} size={16} />
    </button>
  );
}

function AIChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px 5px 8px",
        borderRadius: 99,
        background: "linear-gradient(135deg, rgba(201,123,91,0.12), rgba(217,179,108,0.12))",
        border: "1px solid rgba(201,123,91,0.25)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--terracotta-deep)",
        cursor: "pointer"
      }}
    >
      <Icon name="sparkles" color="var(--terracotta)" size={12} />
      {label}
    </button>
  );
}
