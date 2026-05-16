"use client";

import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { AddEventModal, type ExistingEvent } from "./AddEventModal";
import { DayEventsModal } from "./DayEventsModal";

export type CalEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  calendar: string | null;
  color: string | null;
  persona?: string | null;
  source: string;
};

type Mode = "week" | "month" | "list";

const PERSONA_FALLBACK: Record<string, string> = {
  davide: "#6F8AA8",
  luize: "#D89AA0",
  family: "#C97B5B",
  other: "#5C4F3F"
};

function colorFor(e: CalEvent): string {
  if (e.color) return e.color;
  if (e.persona && PERSONA_FALLBACK[e.persona]) return PERSONA_FALLBACK[e.persona]!;
  // detect from title as last resort (Google-sourced events)
  const t = e.title.toLowerCase();
  if (/\bdavide\b/.test(t)) return PERSONA_FALLBACK.davide!;
  if (/\bluize\b/.test(t)) return PERSONA_FALLBACK.luize!;
  if (/\bfamiglia\b|\bfamily\b|\bcasa\b/.test(t)) return PERSONA_FALLBACK.family!;
  return "var(--blue)";
}

function softFor(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return "rgba(60,45,25,0.06)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ events, onChanged, isWide }: { events: CalEvent[]; onChanged: () => void; isWide: boolean }) {
  const [mode, setMode] = useState<Mode>(isWide ? "week" : "list");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [addingFor, setAddingFor] = useState<Date | null>(null);
  const [browsingDay, setBrowsingDay] = useState<Date | null>(null);
  const [editing, setEditing] = useState<ExistingEvent | null>(null);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Calendar</span>
          <h1 style={{ margin: "4px 0", fontSize: isWide ? 28 : 22, fontWeight: 800 }}>
            {mode === "month"
              ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
              : mode === "week"
                ? `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Agenda"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "list", label: "List" }
            ]}
          />
          <button className="btn btn-ghost" type="button" onClick={() => setAnchor(new Date())}>Today</button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() =>
              setAnchor((d) => (mode === "month" ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : addDays(d, -7)))
            }
            aria-label="Previous"
            style={{ width: 36, padding: 0 }}
          >
            <Icon name="back" color="var(--ink-2)" size={14} />
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() =>
              setAnchor((d) => (mode === "month" ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, 7)))
            }
            aria-label="Next"
            style={{ width: 36, padding: 0 }}
          >
            <Icon name="forward" color="var(--ink-2)" size={14} />
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setAddingFor(new Date(anchor))}>
            <Icon name="plus" color="white" size={16} /> Event
          </button>
        </div>
      </div>

      {mode === "week" && <WeekGrid anchor={anchor} events={events} onSlotClick={(d) => setBrowsingDay(d)} isWide={isWide} />}
      {mode === "month" && <MonthGrid anchor={anchor} events={events} onDayClick={(d) => setBrowsingDay(d)} isWide={isWide} />}
      {mode === "list" && <AgendaList events={events} />}

      <Legend />

      {browsingDay && !addingFor && !editing && (
        <DayEventsModal
          date={browsingDay}
          events={events}
          onClose={() => setBrowsingDay(null)}
          onAdd={() => setAddingFor(browsingDay)}
          onEdit={(e) =>
            setEditing({
              id: e.id,
              title: e.title,
              description: null,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              allDay: e.allDay,
              persona: e.persona ?? null
            })
          }
          onChanged={onChanged}
        />
      )}
      {addingFor && (
        <AddEventModal
          initialDate={addingFor}
          onClose={() => {
            setAddingFor(null);
          }}
          onSaved={() => {
            setAddingFor(null);
            setBrowsingDay(null);
            onChanged();
          }}
        />
      )}
      {editing && (
        <AddEventModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setBrowsingDay(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 4 }}>
      {Object.entries(PERSONA_FALLBACK).map(([k, c]) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: c }} /> {k.charAt(0).toUpperCase() + k.slice(1)}
        </span>
      ))}
    </div>
  );
}

function WeekGrid({
  anchor,
  events,
  onSlotClick,
  isWide
}: {
  anchor: Date;
  events: CalEvent[];
  onSlotClick: (d: Date) => void;
  isWide: boolean;
}) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, { allDay: CalEvent[]; timed: CalEvent[] }>();
    for (const d of days) map.set(d.toDateString(), { allDay: [], timed: [] });
    for (const e of events) {
      const d = new Date(e.startsAt);
      const key = d.toDateString();
      const bucket = map.get(key);
      if (!bucket) continue;
      if (e.allDay) bucket.allDay.push(e);
      else bucket.timed.push(e);
    }
    return map;
  }, [days, events]);

  if (!isWide) {
    // Narrow: vertical stack — one full-width card per day, just the events that matter
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {days.map((d, i) => {
          const key = d.toDateString();
          const isToday = key === today.toDateString();
          const bucket = grouped.get(key)!;
          const sorted = [...bucket.timed].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
          const total = bucket.allDay.length + sorted.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSlotClick(new Date(d))}
              className="card"
              style={{
                padding: "12px 14px",
                textAlign: "left",
                background: isToday ? "linear-gradient(135deg, var(--terracotta-soft), var(--surface))" : undefined,
                borderColor: isToday ? "var(--terracotta)" : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.08,
                    textTransform: "uppercase",
                    color: "var(--ink-3)",
                    minWidth: 32
                  }}
                >
                  {WEEKDAYS[i]}
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: isToday ? "var(--terracotta-deep)" : "var(--ink)"
                  }}
                >
                  {d.getDate()}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>
                  {total === 0 ? "Free" : `${total} event${total === 1 ? "" : "s"}`}
                </span>
              </div>
              {total === 0 ? null : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {bucket.allDay.slice(0, 3).map((e) => (
                    <EventPill key={e.id} event={e} compact />
                  ))}
                  {sorted.slice(0, 3).map((e) => (
                    <EventPill key={e.id} event={e} compact showTime />
                  ))}
                  {total > 6 && (
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>+{total - 6} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {days.map((d, i) => {
        const key = d.toDateString();
        const isToday = key === today.toDateString();
        const bucket = grouped.get(key)!;
        const sorted = [...bucket.timed].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSlotClick(new Date(d))}
            className="card"
            style={{
              minHeight: 160,
              padding: 10,
              textAlign: "left",
              cursor: "pointer",
              background: isToday ? "linear-gradient(160deg, var(--terracotta-soft), var(--surface))" : undefined,
              borderColor: isToday ? "var(--terracotta)" : undefined,
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--ink-3)" }}>
                {WEEKDAYS[i]}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: isToday ? "var(--terracotta-deep)" : "var(--ink)" }}>{d.getDate()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {bucket.allDay.map((e) => (
                <EventPill key={e.id} event={e} compact />
              ))}
              {sorted.slice(0, 6).map((e) => (
                <EventPill key={e.id} event={e} compact showTime />
              ))}
              {sorted.length > 6 && <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>+{sorted.length - 6} more</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({
  anchor,
  events,
  onDayClick,
  isWide
}: {
  anchor: Date;
  events: CalEvent[];
  onDayClick: (d: Date) => void;
  isWide: boolean;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const c of cells) map.set(c.toDateString(), []);
    for (const e of events) {
      const d = new Date(e.startsAt);
      const key = d.toDateString();
      map.get(key)?.push(e);
    }
    return map;
  }, [cells, events]);

  const dayHeaders = isWide ? WEEKDAYS : ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isWide ? 6 : 3, marginBottom: 6 }}>
        {dayHeaders.map((d, i) => (
          <div key={i} className="muted" style={{ fontSize: isWide ? 11 : 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08, textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isWide ? 6 : 3 }}>
        {cells.map((c) => {
          const list = byDay.get(c.toDateString()) ?? [];
          const otherMonth = c.getMonth() !== anchor.getMonth();
          const isToday = c.toDateString() === today.toDateString();
          if (!isWide) {
            // Narrow: tiny cells, only date + color dots
            const personaSet = new Set<string>();
            for (const e of list) personaSet.add(colorFor(e));
            const dots = Array.from(personaSet).slice(0, 4);
            return (
              <button
                key={c.toISOString()}
                type="button"
                onClick={() => onDayClick(new Date(c))}
                style={{
                  aspectRatio: "1 / 1",
                  background: isToday ? "var(--terracotta)" : otherMonth ? "transparent" : "var(--surface-2)",
                  color: isToday ? "white" : otherMonth ? "var(--ink-4)" : "var(--ink)",
                  borderRadius: 8,
                  padding: 4,
                  border: isToday ? "1.5px solid var(--terracotta-deep)" : "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  minHeight: 0
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 12 }}>{c.getDate()}</span>
                <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
                  {dots.map((color, i) => (
                    <span
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 99,
                        background: isToday ? "rgba(255,255,255,0.9)" : color
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          }
          return (
            <button
              key={c.toISOString()}
              type="button"
              onClick={() => onDayClick(new Date(c))}
              style={{
                aspectRatio: "1 / 0.95",
                background: isToday ? "var(--terracotta)" : "var(--surface-2)",
                color: isToday ? "white" : otherMonth ? "var(--ink-4)" : "var(--ink)",
                borderRadius: 12,
                padding: 6,
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                gap: 4,
                minHeight: 0
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14 }}>{c.getDate()}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {list.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: isToday ? "rgba(255,255,255,0.18)" : softFor(colorFor(e)),
                      color: isToday ? "white" : colorFor(e),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {e.title}
                  </span>
                ))}
                {list.length > 3 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? "rgba(255,255,255,0.85)" : "var(--ink-3)" }}>
                    +{list.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function AgendaList({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="card-flat" style={{ padding: 16, borderRadius: 14, borderLeft: "4px solid var(--blue)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>No upcoming events. Tap &quot;Event&quot; up top to add one.</p>
      </div>
    );
  }
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = new Date(e.startsAt).toDateString();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from(groups.entries()).map(([k, list]) => {
        const d = new Date(k);
        const isToday = new Date().toDateString() === k;
        const label = isToday
          ? "Today"
          : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
        return (
          <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.1, color: "var(--ink-3)" }}>{label}</span>
            {list.map((e) => (
              <EventPill key={e.id} event={e} showTime />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function EventPill({ event, compact = false, showTime = false }: { event: CalEvent; compact?: boolean; showTime?: boolean }) {
  const c = colorFor(event);
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const timeLabel = event.allDay ? "All day" : `${fmtTime(start)}${end ? `–${fmtTime(end)}` : ""}`;
  if (compact) {
    return (
      <span
        title={`${event.title} · ${timeLabel}`}
        style={{
          display: "block",
          padding: "3px 6px",
          borderRadius: 6,
          background: softFor(c),
          color: c,
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          borderLeft: `3px solid ${c}`
        }}
      >
        {showTime && !event.allDay ? `${fmtTime(start)} ` : ""}
        {event.title}
      </span>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        background: "var(--surface-2)",
        borderRadius: 14,
        borderLeft: `4px solid ${c}`
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {event.title}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {timeLabel}
          {event.calendar ? ` · ${event.calendar}` : ""}
        </div>
      </div>
    </div>
  );
}
