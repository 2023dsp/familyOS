"use client";

import { useEffect, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";

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

export function AddEventModal({
  onClose,
  onSaved,
  initialDate
}: {
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date;
}) {
  const seed = initialDate ?? new Date();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(localToInputDate(seed));
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState(localToInputTime(seed));
  const [endTime, setEndTime] = useState(() => {
    const e = new Date(seed.getTime() + 60 * 60 * 1000);
    return localToInputTime(e);
  });
  const [persona, setPersona] = useState<Persona>("other");
  const [autoPersona, setAutoPersona] = useState(true);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (autoPersona && title) setPersona(detectPersona(title));
  }, [title, autoPersona]);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const startsAt = inputsToIso(date, allDay ? "00:00" : startTime);
      const endsAt = inputsToIso(date, allDay ? "23:59" : endTime);
      const res = await fetch("/api/calendar/events", {
        method: "POST",
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

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 8px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>New event</h2>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
            Color follows the person. Try titles like &quot;Davide serata fuori&quot; or &quot;Luize viaggio Svizzera&quot;.
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }} aria-label="Close">
          <Icon name="close" color="var(--ink-2)" size={18} />
        </button>
      </div>

      <div className="scroll" style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <input
          className="input"
          placeholder='Title (e.g. "Davide serata fuori")'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          style={{ fontSize: 16 }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Who</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PERSONAS.map((p) => {
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

      <div style={{ display: "flex", gap: 12, padding: "16px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <button className="btn btn-ghost" onClick={onClose} type="button" style={{ flex: 0.4 }}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim()} type="button" style={{ flex: 1 }}>
          <Icon name="check" color="white" size={16} /> {busy ? "Saving…" : "Add event"}
        </button>
      </div>
    </ModalBackdrop>
  );
}
