"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Household purchase rules the research agent applies to every purchase. */
export function PurchaseRulesCard() {
  const [rules, setRules] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings/purchase-rules", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setRules(j.rules);
      setIsDefault(!!j.isDefault);
      setConfigured(!!j.configured);
    })();
  }, []);

  async function save(value: string | null) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/purchase-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: value })
      });
      if (!res.ok) throw new Error("Save failed");
      const j = await res.json();
      setRules(j.rules);
      setIsDefault(!!j.isDefault);
      setDirty(false);
      setMsg("Saved");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Icon name="cart" color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Purchase rules</h3>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
        The research agent applies these automatically to every purchase: shops, delivery country, where things must be made.
        {!configured && " The agent is not active yet: the server is missing an Anthropic API key."}
      </p>
      <textarea
        className="input"
        value={rules}
        onChange={(e) => {
          setRules(e.target.value);
          setDirty(true);
          setMsg(null);
        }}
        disabled={busy}
        style={{ minHeight: 220, fontSize: 13, resize: "vertical", paddingTop: 10, lineHeight: 1.45 }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => save(rules)} style={{ padding: "6px 14px", fontSize: 13 }}>
          Save
        </button>
        {!isDefault && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => save(null)} style={{ padding: "6px 14px", fontSize: 13 }}>
            Reset to default
          </button>
        )}
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </div>
  );
}
