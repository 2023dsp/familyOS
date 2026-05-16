"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Daily = { date: string; min: number; max: number; code: number };
type Current = { tempNow: number; min: number; max: number; code: number };

const WMO: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear", emoji: "☀️" },
  1: { label: "Mostly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Rime fog", emoji: "🌫️" },
  51: { label: "Drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Drizzle", emoji: "🌦️" },
  61: { label: "Rain", emoji: "🌧️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  71: { label: "Snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "🌨️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Showers", emoji: "🌦️" },
  81: { label: "Showers", emoji: "🌦️" },
  82: { label: "Heavy showers", emoji: "⛈️" },
  95: { label: "Thunder", emoji: "⛈️" },
  96: { label: "Thunder", emoji: "⛈️" },
  99: { label: "Thunder", emoji: "⛈️" }
};

function code(c: number) {
  return WMO[c] ?? { label: "—", emoji: "🌡️" };
}

const LAT = parseFloat(process.env.NEXT_PUBLIC_WEATHER_LAT ?? "45.4642"); // Milan default
const LON = parseFloat(process.env.NEXT_PUBLIC_WEATHER_LON ?? "9.19");
const LABEL = process.env.NEXT_PUBLIC_WEATHER_LABEL ?? "Milan";

export function WeatherCard({ compact = false }: { compact?: boolean }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Forecast unavailable");
        const j = await res.json();
        if (cancelled) return;
        const c: Current = {
          tempNow: Math.round(j.current?.temperature_2m ?? 0),
          min: Math.round(j.daily?.temperature_2m_min?.[0] ?? 0),
          max: Math.round(j.daily?.temperature_2m_max?.[0] ?? 0),
          code: j.current?.weather_code ?? 0
        };
        const d: Daily[] = (j.daily?.time as string[]).map((t, i) => ({
          date: t,
          min: Math.round(j.daily.temperature_2m_min[i]),
          max: Math.round(j.daily.temperature_2m_max[i]),
          code: j.daily.weather_code[i]
        }));
        setCurrent(c);
        setDaily(d);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (error) {
    return (
      <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="sun" color="var(--sand)" size={20} />
        <span className="muted" style={{ fontSize: 13 }}>Weather unavailable</span>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>Loading weather…</span>
      </div>
    );
  }

  const c = code(current.code);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: open ? 14 : 0,
        background: "linear-gradient(160deg, var(--sand-soft), var(--surface))",
        textAlign: "left",
        cursor: "pointer",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: compact ? 30 : 38 }}>{c.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: compact ? 26 : 30, fontWeight: 800, lineHeight: 1, color: "var(--ink)" }}>
              {current.tempNow}°
            </span>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{LABEL}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
            {c.label} · {current.min}° / {current.max}°
          </div>
        </div>
        <Icon name="chevron" color="var(--ink-3)" size={14} className={open ? "rot-90" : undefined} />
      </div>

      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 4 }}>
          {daily.map((d, i) => {
            const dt = new Date(d.date);
            const isToday = i === 0;
            const dow = dt.toLocaleDateString(undefined, { weekday: "short" });
            const dnum = dt.getDate();
            const k = code(d.code);
            return (
              <div
                key={d.date}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "8px 4px",
                  borderRadius: 12,
                  background: isToday ? "var(--surface-2)" : "transparent",
                  border: isToday ? "1px solid var(--line-2)" : "1px solid transparent"
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.06, color: "var(--ink-3)" }}>
                  {dow}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)" }}>{dnum}</span>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{k.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>{d.max}°</span>
                <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 600 }}>{d.min}°</span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
