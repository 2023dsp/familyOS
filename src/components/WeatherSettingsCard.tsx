"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Config = { lat: number; lon: number; label: string };
type SearchHit = {
  id?: number;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

export function WeatherSettingsCard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/weather", { cache: "no-store" });
    if (res.ok) setConfig((await res.json()).config);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(c: Config) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/weather", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c)
      });
      if (!res.ok) throw new Error("Save failed");
      setConfig(c);
      setHits([]);
      setQuery("");
      setMsg("Saved.");
      // Tell other tabs (WeatherCard) to refresh
      window.dispatchEvent(new Event("familyos-weather-config"));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm("Reset weather location?")) return;
    setBusy(true);
    try {
      await fetch("/api/settings/weather", { method: "DELETE" });
      setConfig(null);
      setMsg("Cleared.");
      window.dispatchEvent(new Event("familyos-weather-config"));
    } finally {
      setBusy(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setMsg("Geolocation not supported on this device.");
      return;
    }
    setBusy(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode via Open-Meteo for a nice label
        let label = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        try {
          const r = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en`
          );
          if (r.ok) {
            const j = await r.json();
            const top = j.results?.[0];
            if (top?.name) label = top.admin1 ? `${top.name}, ${top.admin1}` : top.name;
          }
        } catch {
          /* ignore */
        }
        await save({ lat: latitude, lon: longitude, label });
      },
      (err) => {
        setBusy(false);
        setMsg(err.message || "Could not get location.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setMsg(null);
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=en`
      );
      const j = await r.json();
      setHits((j.results ?? []) as SearchHit[]);
      if (!j.results || j.results.length === 0) setMsg("No matches.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="sun" color="var(--sand)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Weather location</h3>
        {config && (
          <span className="pill" style={{ background: "var(--olive-soft)", color: "var(--olive)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--olive)" }} />
            On
          </span>
        )}
      </div>

      {config ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{config.label}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {config.lat.toFixed(3)}, {config.lon.toFixed(3)}
          </span>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          No location set. Use GPS or search a city below.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={useGps} disabled={busy} type="button">
          <Icon name="home" color="var(--ink-2)" size={14} /> Use my location
        </button>
        {config && (
          <button className="btn btn-ghost" onClick={clear} disabled={busy} type="button" style={{ color: "var(--danger)" }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>
          Or search a city
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Milano, Rome, Berlin"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            style={{ fontSize: 14, flex: 1 }}
          />
          <button className="btn btn-primary" onClick={search} disabled={searching || !query.trim()} type="button">
            <Icon name="forward" color="white" size={14} /> Search
          </button>
        </div>
        {hits.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {hits.map((h, i) => {
              const lbl = [h.name, h.admin1, h.country].filter(Boolean).join(", ");
              return (
                <button
                  key={i}
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    save({ lat: h.latitude, lon: h.longitude, label: h.admin1 ? `${h.name}, ${h.admin1}` : h.name })
                  }
                  disabled={busy}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span>{lbl}</span>
                  <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
                    {h.latitude.toFixed(2)}, {h.longitude.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {msg && <p style={{ marginTop: 12, fontSize: 12, color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}
