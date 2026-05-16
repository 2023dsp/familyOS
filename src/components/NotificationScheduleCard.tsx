"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Schedule = {
  daily: { enabled: boolean; when: "evening-before" | "morning-of"; hour: number; minute: number };
  weekly: { enabled: boolean; dow: number; hour: number; minute: number };
};

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function parseHHMM(v: string): { hour: number; minute: number } {
  const [a, b] = v.split(":").map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(a) ? a : 0, minute: Number.isFinite(b) ? b : 0 };
}

export function NotificationScheduleCard() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings/notifications", { cache: "no-store" });
    if (res.ok) setSchedule((await res.json()).schedule);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(next: Schedule) {
    setBusy(true);
    setMsg(null);
    setSchedule(next);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!schedule) {
    return (
      <div className="card">
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Notification schedule</h3>
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="clock" color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Notification schedule</h3>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
        Times are Europe/Rome. The host checks every 5 minutes and fires within a ~6 minute window.
      </p>

      {/* Daily */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Daily digest</div>
            <div className="muted" style={{ fontSize: 12 }}>Push the day&apos;s chore plan.</div>
          </div>
          <Toggle on={schedule.daily.enabled} onChange={(v) => save({ ...schedule, daily: { ...schedule.daily, enabled: v } })} disabled={busy} />
        </div>
        {schedule.daily.enabled && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["evening-before", "morning-of"] as const).map((w) => {
                const sel = schedule.daily.when === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => save({ ...schedule, daily: { ...schedule.daily, when: w } })}
                    disabled={busy}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 99,
                      background: sel ? "var(--terracotta-soft)" : "rgba(0,0,0,0.04)",
                      border: sel ? "1.5px solid var(--terracotta)" : "1.5px solid transparent",
                      fontWeight: 700, fontSize: 12,
                      color: sel ? "var(--terracotta-deep)" : "var(--ink-2)"
                    }}
                  >
                    {w === "evening-before" ? "Evening before · for next day" : "Morning of · for today"}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              value={hhmm(schedule.daily.hour, schedule.daily.minute)}
              onChange={(e) => {
                const { hour, minute } = parseHHMM(e.target.value);
                save({ ...schedule, daily: { ...schedule.daily, hour, minute } });
              }}
              disabled={busy}
              style={{
                border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
              }}
            />
          </div>
        )}
      </section>

      {/* Weekly */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Weekly digest</div>
            <div className="muted" style={{ fontSize: 12 }}>Push the week&apos;s outlook.</div>
          </div>
          <Toggle on={schedule.weekly.enabled} onChange={(v) => save({ ...schedule, weekly: { ...schedule.weekly, enabled: v } })} disabled={busy} />
        </div>
        {schedule.weekly.enabled && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {DOW_LABEL.map((lbl, i) => {
                const sel = schedule.weekly.dow === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => save({ ...schedule, weekly: { ...schedule.weekly, dow: i } })}
                    disabled={busy}
                    style={{
                      width: 38, height: 32, borderRadius: 10,
                      background: sel ? "var(--olive)" : "var(--surface-2)",
                      color: sel ? "white" : "var(--ink-2)",
                      fontWeight: 800, fontSize: 12,
                      border: "none"
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              value={hhmm(schedule.weekly.hour, schedule.weekly.minute)}
              onChange={(e) => {
                const { hour, minute } = parseHHMM(e.target.value);
                save({ ...schedule, weekly: { ...schedule.weekly, hour, minute } });
              }}
              disabled={busy}
              style={{
                border: "1.5px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                padding: "6px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: "inherit"
              }}
            />
          </div>
        )}
      </section>

      {msg && <p style={{ marginTop: 12, fontSize: 12, color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
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
