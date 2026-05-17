"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import { useMembersForPersona } from "./FamilyMembersContext";

const PERSONAS = [
  { id: "davide", label: "Davide", color: "#6F8AA8", soft: "#D6E0EB" },
  { id: "luize", label: "Luize", color: "#D89AA0", soft: "#F4DCDF" },
  { id: "family", label: "Family", color: "#C97B5B", soft: "#E8C2AC" },
  { id: "other", label: "Other", color: "#5C4F3F", soft: "#DFD0B4" }
] as const;
type Persona = (typeof PERSONAS)[number]["id"];

function localToInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function localToInputTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function inputsToIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  let hh = 9, mm = 0;
  if (timeStr) {
    const [a, b] = timeStr.split(":").map((n) => parseInt(n, 10));
    if (!Number.isNaN(a)) hh = a;
    if (!Number.isNaN(b)) mm = b;
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

function detectPersona(title: string): Persona {
  const t = title.toLowerCase();
  if (/\bdavide\b/.test(t)) return "davide";
  if (/\bluize\b/.test(t)) return "luize";
  if (/\bfamiglia\b|\bfamily\b|\bcasa\b|\bhome\b/.test(t)) return "family";
  return "other";
}

export type ExistingEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  persona?: string | null;
};

export function AddEventModal({
  onClose,
  onSaved,
  initialDate,
  existing
}: {
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date;
  existing?: ExistingEvent;
}) {
  const householdMembers = useMembersForPersona();
  const personaOptions: Array<{ id: string; label: string; color: string; soft: string }> = [
    ...householdMembers.map((m) => ({ id: m.slug, label: m.name, color: m.color, soft: softenHex(m.color) })),
    FAMILY_OPT,
    OTHER_OPT
  ];
  const isEdit = !!existing;
  const seed = existing ? new Date(existing.startsAt) : initialDate ?? new Date();
  const endSeed = existing && existing.endsAt ? new Date(existing.endsAt) : new Date(seed.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(localToInputDate(seed));
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [startTime, setStartTime] = useState(localToInputTime(seed));
  const [endTime, setEndTime] = useState(localToInputTime(endSeed));
  const [persona, setPersona] = useState<Persona>(
    (existing?.persona as Persona) ?? "other"
  );
  const [autoPersona, setAutoPersona] = useState(!isEdit);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(!isEdit);

  useEffect(() => {
    if (autoPersona && title) setPersona(detectPersona(title, householdMembers));
  }, [title, autoPersona, householdMembers]);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const startsAt = inputsToIso(date, allDay ? "00:00" : startTime);
      const endsAt = inputsToIso(date, allDay ? "23:59" : endTime);
      const url = isEdit ? `/api/calendar/events/${existing!.id}` : "/api/calendar/events";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          startsAt,
          endsAt,
          allDay,
          persona
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm("Delete this event?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/calendar/events/${existing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const personaMeta = personaOptions.find((p) => p.id === persona) ?? OTHER_OPT;
  const dueLabelDate = (() => {
    const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  })();

  if (isEdit && !editing) {
    return (
      <ModalBackdrop onClose={onClose}>
        <div style={{ padding: "24px 24px 20px", background: `linear-gradient(160deg, ${personaMeta.soft}, transparent 70%)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: personaMeta.color, flexShrink: 0 }} />
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}>{title}</h2>
            </div>
            <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center", flexShrink: 0 }} aria-label="Close">
              <Icon name="close" color="var(--ink-2)" size={18} />
            </button>
          </div>
        </div>

        <div className="scroll" style={{ padding: "0 24px", flex: 1, minHeight: 0, overflowY: "auto" }}>
          <DetailRow label="Who" value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: personaMeta.color }} />
              {personaMeta.label}
            </span>
          } />
          <DetailRow label="Date" value={<span style={{ fontWeight: 700, fontSize: 13 }}>{dueLabelDate}</span>} />
          <DetailRow label="Time" value={
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              {allDay ? "All day" : `${startTime} – ${endTime}`}
            </span>
          } />
          {description.trim() && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 0", borderTop: "1px solid var(--line)" }}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Notes</span>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{description}</p>
            </div>
          )}
        </div>

        {err && <div style={{ padding: "8px 24px 0", color: "var(--danger)", fontWeight: 700, fontSize: 13 }}>{err}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
          <button className="btn btn-ghost" onClick={remove} disabled={busy} type="button" style={{ color: "var(--danger)" }}>
            <Icon name="archive" color="var(--danger)" size={14} /> Delete
          </button>
          <button className="btn btn-primary" onClick={() => setEditing(true)} type="button" style={{ flex: 1, minWidth: 160 }}>
            <Icon name="settings" color="white" size={16} /> Edit
          </button>
        </div>
      </ModalBackdrop>
    );
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 8px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isEdit ? "Edit event" : "New event"}</h2>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
            {isEdit ? "Update fields and tap Save." : "Color follows the person. Try titles like \"Davide serata fuori\"."}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }} aria-label="Close">
          <Icon name="close" color="var(--ink-2)" size={18} />
        </button>
      </div>

      <div className="scroll" style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <input
          className="input"
          placeholder='Title (e.g. "Davide serata fuori")'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ fontSize: 16 }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Who</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {personaOptions.map((p) => {
              const sel = persona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPersona(p.id);
                    setAutoPersona(false);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 99,
                    background: sel ? p.soft : "rgba(0,0,0,0.04)",
                    border: sel ? `1.5px solid ${p.color}` : "1.5px solid transparent",
                    fontWeight: 700,
                    fontSize: 13,
                    color: sel ? p.color : "var(--ink-2)"
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: p.color }} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Date</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 14 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}>
            <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>All day</span>
            <button
              type="button"
              onClick={() => setAllDay((v) => !v)}
              style={{
                width: 52,
                height: 28,
                borderRadius: 99,
                padding: 3,
                background: allDay ? "var(--olive)" : "rgba(0,0,0,0.12)",
                transition: "background 0.18s"
              }}
              aria-pressed={allDay}
            >
              <span
                style={{
                  display: "block",
                  width: 22,
                  height: 22,
                  borderRadius: 99,
                  background: "white",
                  transform: `translateX(${allDay ? 22 : 0}px)`,
                  transition: "transform 0.18s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }}
              />
            </button>
          </div>
        </div>

        {!allDay && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 130, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>From</span>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ fontSize: 14 }} />
            </div>
            <div style={{ flex: 1, minWidth: 130, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>To</span>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ fontSize: 14 }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Notes (optional)</span>
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything else worth remembering"
            style={{ minHeight: 56, resize: "none", paddingTop: 12, fontSize: 14 }}
          />
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700 }}>{err}</div>}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onClose} type="button">Cancel</button>
        {isEdit && (
          <button className="btn btn-ghost" onClick={remove} disabled={busy} type="button" style={{ color: "var(--danger)" }}>
            <Icon name="archive" color="var(--danger)" size={14} /> Delete
          </button>
        )}
        <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim()} type="button" style={{ flex: 1, minWidth: 160 }}>
          <Icon name="check" color="white" size={16} /> {busy ? "Saving…" : isEdit ? "Save changes" : "Add event"}
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
