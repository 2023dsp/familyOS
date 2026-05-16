"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

type Status = {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
};

export function GoogleCalendarCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const url = new URL(window.location.href);
    if (url.searchParams.get("google") === "connected") {
      setMsg("Google Calendar connected.");
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url.toString());
    } else if (url.searchParams.get("google") === "error") {
      setMsg(`Could not connect: ${url.searchParams.get("message") ?? "unknown"}`);
      url.searchParams.delete("google");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.toString());
    }
  }, [load]);

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Sync failed");
      setMsg(`Synced · pulled ${j.pulled}, pushed ${j.pushed}`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Pushed events stay on Google; sync state is cleared.")) return;
    setBusy(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setMsg("Disconnected.");
      load();
    } finally {
      setBusy(false);
    }
  }

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : "never";

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="link" color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Google Calendar</h3>
        {status?.connected && (
          <span className="pill" style={{ background: "var(--olive-soft)", color: "var(--olive)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--olive)" }} />
            Live
          </span>
        )}
      </div>

      {!status ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : !status.connected ? (
        <>
          <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5 }}>
            Connect a shared family Google account to read upcoming events and push chores with a due date as
            all-day calendar entries (two-way sync).
          </p>
          <a className="btn btn-primary" href="/api/google/connect">
            <Icon name="link" color="white" size={16} /> Connect Google Calendar
          </a>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Account: <b>{status.email ?? status.calendarId ?? "primary"}</b>
            </span>
            <span className="muted" style={{ fontSize: 12 }}>Last sync · {lastSync}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="btn btn-primary" onClick={syncNow} disabled={busy} type="button">
              <Icon name="refresh" color="white" size={16} /> {busy ? "Syncing…" : "Sync now"}
            </button>
            <button className="btn btn-ghost" onClick={disconnect} disabled={busy} type="button" style={{ color: "var(--danger)" }}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {msg && <p style={{ marginTop: 12, fontSize: 13, color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}
