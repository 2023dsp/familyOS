"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { WeatherIcon, weatherLabel } from "./WeatherIcon";

type Daily = { date: string; min: number; max: number; code: number };
type Current = { tempNow: number; min: number; max: number; code: number };
type Config = { lat: number; lon: number; label: string };

const ENV_LAT = process.env.NEXT_PUBLIC_WEATHER_LAT;
const ENV_LON = process.env.NEXT_PUBLIC_WEATHER_LON;
const ENV_LABEL = process.env.NEXT_PUBLIC_WEATHER_LABEL ?? "Home";

export function WeatherCard({ compact = false }: { compact?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/weather", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j.config) {
          setConfig(j.config);
          return;
        }
      }
    } catch {
      /* fall through */
    }
    const envLat = ENV_LAT ? parseFloat(ENV_LAT) : NaN;
    const envLon = ENV_LON ? parseFloat(ENV_LON) : NaN;
    if (Number.isFinite(envLat) && Number.isFinite(envLon)) {
      setConfig({ lat: envLat, lon: envLon, label: ENV_LABEL });
    } else {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    const onChange = () => loadConfig();
    window.addEventListener("familyos-weather-config", onChange);
    return () => window.removeEventListener("familyos-weather-config", onChange);
  }, [loadConfig]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    async function load() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${config!.lat}&longitude=${config!.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;
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
        setError(null);
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
  }, [config]);

  if (!config) {
    return (
      <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(160deg, var(--sand-soft), var(--surface))" }}>
        <Icon name="sun" color="var(--sand)" size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Weather</div>
          <div className="muted" style={{ fontSize: 12 }}>Set a location in Settings → Weather.</div>
        </div>
      </div>
    );
  }

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

  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 20;

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: open ? 12 : 0,
        background: "linear-gradient(160deg, var(--sand-soft), var(--surface))",
        textAlign: "left",
        cursor: "pointer",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <WeatherIcon code={current.code} size={compact ? 40 : 48} isNight={isNight} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: compact ? 26 : 30, fontWeight: 800, lineHeight: 1, color: "var(--ink)" }}>
              {current.tempNow}°
            </span>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {config.label}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
            {weatherLabel(current.code)} · {current.min}° / {current.max}°
          </div>
        </div>
        <Icon name="chevron" color="var(--ink-3)" size={14} />
      </div>

      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 4 }}>
          {daily.map((d, i) => {
            const dt = new Date(d.date);
            const isToday = i === 0;
            const dow = dt.toLocaleDateString(undefined, { weekday: "short" });
            const dnum = dt.getDate();
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
                <WeatherIcon code={d.code} size={28} />
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
