"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Segmented } from "./Segmented";
import { ASSIGNEES, type AssigneeSlug, type PriorityKey } from "../lib/catalog";
import { useCategories } from "./CategoriesContext";
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

export type AddChorePrefill = {
  title?: string;
  icon?: string;
  category?: string;
  priority?: PriorityKey;
  recurInterval?: number;
  recurUnit?: RecurrenceUnit;
};

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
  const [text, setText] = useState(prefill?.title ?? "");
  const [icon, setIcon] = useState(prefill?.icon ?? "broom");
  const [category, setCategory] = useState(prefill?.category ?? "cleaning");
  const [assignee, setAssignee] = useState<AssigneeSlug>("both");
  const [priority, setPriority] = useState<PriorityKey>(prefill?.priority ?? "medium");
  const [due, setDue] = useState<string>(quickDate("today"));
  const [recurInterval, setRecurInterval] = useState<number | null>(prefill?.recurInterval ?? null);
  const [recurUnit, setRecurUnit] = useState<RecurrenceUnit | null>(prefill?.recurUnit ?? null);
  const [notes, setNotes] = useState("");
  const [important, setImportant] = useState(false);
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
    if (k === "recurInterval" && typeof v === "number") setRecurInterval(v);
    if (k === "recurUnit" && typeof v === "string") setRecurUnit(v as RecurrenceUnit);
    if (k === "dueHint") {
      if (v === "today") setDue(quickDate("today"));
      else if (v === "tomorrow") setDue(quickDate("tomorrow"));
      else if (v === "weekend") setDue(quickDate("weekend"));
    }
    setDismissed((d) => ({ ...d, [k]: true }));
  };

  const cleanTitle = suggestion.cleanTitle || text.trim();
  const hasRecur = recurInterval != null && recurUnit != null;

  const recurChoices: Array<{ key: string; label: string; interval: number; unit: RecurrenceUnit | null }> = [
    { key: "none", label: "Once", interval: 0, unit: null },
    { key: "daily", label: "Daily", interval: 1, unit: "day" },
    { key: "weekly", label: "Weekly", interval: 1, unit: "week" },
    { key: "monthly", label: "Monthly", interval: 1, unit: "month" },
    { key: "every-2d", label: "Every 2 days", interval: 2, unit: "day" },
    { key: "every-6m", label: "Every 6 months", interval: 6, unit: "month" }
  ];
  const recurKey =
    !hasRecur ? "none" :
    recurInterval === 1 && recurUnit === "day" ? "daily" :
    recurInterval === 1 && recurUnit === "week" ? "weekly" :
    recurInterval === 1 && recurUnit === "month" ? "monthly" :
    recurInterval === 2 && recurUnit === "day" ? "every-2d" :
    recurInterval === 6 && recurUnit === "month" ? "every-6m" : "custom";

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
          assigneeSlug: assignee,
          dueDate: dueInputToIso(due),
          isRecurring: hasRecur,
          recurInterval: recurInterval ?? undefined,
          recurUnit: recurUnit ?? undefined,
          important
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to save");
      }
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
        <div style={{ position: "relative" }}>
          <input
            className="input"
            placeholder='Try: "clean garden Saturday" or "change tires every 6 months"'
            value={text}
            onChange={(e) => { setText(e.target.value); setDismissed({}); }}
            autoFocus
            style={{ paddingLeft: 44, fontSize: 16 }}
          />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
            <Icon name="sparkles" color="var(--terracotta)" size={20} />
          </span>
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

        <Section label="Assignee">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(["davide", "luize", "both", "unassigned"] as const).map((a) => {
              const sel = assignee === a;
              return (
                <button
                  key={a}
                  onClick={() => setAssignee(a)}
                  type="button"
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
                  <Avatar who={a} size={26} />
                  {ASSIGNEES[a].name}
                </button>
              );
            })}
          </div>
        </Section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <Section label="Priority" style={{ flex: 1, minWidth: 220 }}>
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
          <Section label="Deadline" style={{ flex: 1, minWidth: 220 }}>
            <DueDatePicker value={due} onChange={setDue} />
          </Section>
        </div>

        <Section label="Recurrence">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recurChoices.map((r) => {
              const sel = recurKey === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => {
                    setRecurInterval(r.unit ? r.interval : null);
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
            {important ? "Pinned · shows on the dashboard top" : "Not pinned · pin big decisions like \"School choice for Ellie\""}
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
