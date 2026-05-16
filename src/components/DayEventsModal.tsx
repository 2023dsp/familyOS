"use client";

import { useMemo, useState } from "react";
import { ModalBackdrop } from "./ModalBackdrop";
import { Icon } from "./Icon";
import type { CalEvent } from "./CalendarView";

const PERSONA_COLORS: Record<string, string> = {
  davide: "#6F8AA8",
  luize: "#D89AA0",
  family: "#C97B5B",
  other: "#5C4F3F"
};

function colorFor(e: CalEvent): string {
  if (e.color) return e.color;
  if (e.persona && PERSONA_COLORS[e.persona]) return PERSONA_COLORS[e.persona]!;
  const t = e.title.toLowerCase();
  if (/\bdavide\b/.test(t)) return PERSONA_COLORS.davide!;
  if (/\bluize\b/.test(t)) return PERSONA_COLORS.luize!;
  if (/\bfamiglia\b|\bfamily\b|\bcasa\b/.test(t)) return PERSONA_COLORS.family!;
  return "#5C4F3F";
}

function softFor(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return "rgba(60,45,25,0.06)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function DayEventsModal({
  date,
  events,
  onClose,
  onAdd,
  onEdit,
  onChanged
}: {
  date: Date;
  events: CalEvent[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (e: CalEvent) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => {
    const key = date.toDateString();
    return events
      .filter((e) => new Date(e.startsAt).toDateString() === key)
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  }, [date, events]);

  const isToday = date.toDateString() === new Date().toDateString();
  const heading = isToday
    ? "Today"
    : date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const sub = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  async function remove(id: string) {
    if (!confirm("Delete this event?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
      if (res.ok) onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 8px" }}>
        <div>
          <span className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08 }}>
            {isToday ? sub : "Day"}
          </span>
          <h2 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800 }}>{heading}</h2>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost"
          type="button"
          style={{ width: 36, height: 36, borderRadius: 99, display: "grid", placeItems: "center" }}
          aria-label="Close"
        >
          <Icon name="close" color="var(--ink-2)" size={18} />
        </button>
      </div>

      <div className="scroll" style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
        {list.length === 0 ? (
          <div className="card-flat" style={{ padding: 18, borderRadius: 14, borderLeft: "4px solid var(--blue)", textAlign: "center" }}>
            <Icon name="calendar" color="var(--ink-3)" size={28} />
            <p style={{ margin: "8px 0 0", fontWeight: 700 }}>No events on this day.</p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Tap &quot;Add event&quot; below to plan one.</p>
          </div>
        ) : (
          list.map((e) => {
            const c = colorFor(e);
            const start = new Date(e.startsAt);
            const end = e.endsAt ? new Date(e.endsAt) : null;
            const timeLabel = e.allDay ? "All day" : `${fmtTime(start)}${end ? ` – ${fmtTime(end)}` : ""}`;
            const isGoogle = e.source === "google";
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onEdit(e)}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  background: softFor(c),
                  borderRadius: 14,
                  borderLeft: `4px solid ${c}`,
                  alignItems: "center",
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600, marginTop: 2 }}>
                    {timeLabel}
                    {e.calendar && !isGoogle ? ` · ${e.calendar}` : ""}
                    {isGoogle ? " · Google" : ""}
                  </div>
                </div>
                <Icon name="chevron" color="var(--ink-3)" size={14} />
                <span
                  onClick={(ev) => {
                    ev.stopPropagation();
                    remove(e.id);
                  }}
                  role="button"
                  aria-label="Delete"
                  style={{ padding: 8, color: "var(--danger)", borderRadius: 10, display: "inline-flex", opacity: busy === e.id ? 0.4 : 1 }}
                >
                  <Icon name="archive" color="var(--danger)" size={14} />
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "14px 24px 20px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <button className="btn btn-ghost" type="button" onClick={onClose} style={{ flex: 0.4 }}>
          Close
        </button>
        <button className="btn btn-primary" type="button" onClick={onAdd} style={{ flex: 1 }}>
          <Icon name="plus" color="white" size={16} /> Add event
        </button>
      </div>
    </ModalBackdrop>
  );
}
