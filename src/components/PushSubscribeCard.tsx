"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "denied" | "off" | "on";

export function PushSubscribeCard() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function check() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }

  useEffect(() => {
    check();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const keyRes = await fetch("/api/push/vapid-public");
      if (!keyRes.ok) throw new Error("Push not configured");
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource
        });
      }
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
      });
      if (!res.ok) throw new Error("Could not register subscription");
      setState("on");
      setMsg("Push enabled on this device.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Push disabled on this device.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Failed");
      setMsg(`Sent · ${j.sent} delivered (${j.pruned} dead subs pruned)`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name="sparkles" color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Push notifications</h3>
        {state === "on" && (
          <span className="pill" style={{ background: "var(--olive-soft)", color: "var(--olive)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--olive)" }} />
            On
          </span>
        )}
      </div>

      {state === "loading" && <p className="muted" style={{ fontSize: 13 }}>Checking permissions…</p>}

      {state === "unsupported" && (
        <p className="muted" style={{ fontSize: 13 }}>
          This browser doesn&apos;t support web push. On iOS, install the app first (Share → Add to Home Screen)
          then open from the home screen — iOS 16.4+ supports push only in installed PWAs.
        </p>
      )}

      {state === "denied" && (
        <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 600, margin: 0 }}>
          You blocked notifications for this site. Re-enable in your browser settings, then come back.
        </p>
      )}

      {state === "off" && (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Get a daily morning digest and reminders for today&apos;s chores on this device. Each device must be
            enabled separately.
          </p>
          <button className="btn btn-primary" onClick={enable} disabled={busy} type="button">
            <Icon name="sparkles" color="white" size={16} /> {busy ? "Enabling…" : "Enable on this device"}
          </button>
        </>
      )}

      {state === "on" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn btn-ghost" onClick={testPush} disabled={busy} type="button">
            <Icon name="sparkles" color="var(--ink-2)" size={16} /> Send test
          </button>
          <button className="btn btn-ghost" onClick={disable} disabled={busy} type="button" style={{ color: "var(--danger)" }}>
            Disable on this device
          </button>
        </div>
      )}

      {msg && <p style={{ marginTop: 12, fontSize: 13, color: "var(--ink-2)" }}>{msg}</p>}
    </div>
  );
}
