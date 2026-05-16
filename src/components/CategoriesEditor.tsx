"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type ApiCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  color: string;
  colorSoft: string;
  sortOrder: number;
  isCustom: boolean;
};

const ICON_PICK = ["broom", "dishes", "trash", "plant", "drop", "bulb", "cart", "car", "sofa", "card", "book", "tools", "home", "layers", "calendar", "users"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function softenHex(hex: string): string {
  // very rough lightener: mix with #FAF5EA at 70%
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number, t: number) => Math.round(c * 0.3 + t * 0.7);
  const rr = mix(r, 250);
  const gg = mix(g, 245);
  const bb = mix(b, 234);
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

export function CategoriesEditor() {
  const [items, setItems] = useState<ApiCategory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New form
  const [open, setOpen] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nIcon, setNIcon] = useState("layers");
  const [nColor, setNColor] = useState("#C97B5B");

  async function load() {
    const res = await fetch("/api/categories", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).categories);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nLabel) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugify(nLabel),
          label: nLabel,
          icon: nIcon,
          color: nColor,
          colorSoft: softenHex(nColor)
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setNLabel("");
      setOpen(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, data: Partial<ApiCategory>) {
    setBusy(true);
    try {
      await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="layers" color="var(--terracotta)" size={22} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Categories</h3>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ padding: "6px 12px", fontSize: 13 }}
        >
          <Icon name="plus" color="var(--ink-2)" size={14} /> New
        </button>
      </div>

      {open && (
        <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="input" placeholder="Label (e.g. Kids)" value={nLabel} onChange={(e) => setNLabel(e.target.value)} style={{ fontSize: 14 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ICON_PICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNIcon(n)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: nIcon === n ? "var(--terracotta-soft)" : "var(--surface)",
                  border: nIcon === n ? "1.5px solid var(--terracotta)" : "1.5px solid transparent",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                <Icon name={n} color={nIcon === n ? "var(--terracotta-deep)" : "var(--ink-2)"} size={18} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>Color</label>
            <input type="color" value={nColor} onChange={(e) => setNColor(e.target.value)} style={{ width: 44, height: 32, border: "none", padding: 0, background: "transparent" }} />
            <button className="btn btn-primary" type="button" onClick={create} disabled={busy || !nLabel} style={{ marginLeft: "auto" }}>
              <Icon name="check" color="white" size={14} /> Add
            </button>
          </div>
        </div>
      )}

      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{err}</div>}

      {!items ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No categories yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: c.colorSoft, display: "grid", placeItems: "center" }}>
                <Icon name={c.icon} color={c.color} size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.label}</div>
                <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono, monospace)" }}>
                  {c.slug} · {c.color}
                </div>
              </div>
              <input
                type="color"
                value={c.color}
                onChange={(e) => patch(c.id, { color: e.target.value, colorSoft: softenHex(e.target.value) })}
                disabled={busy}
                style={{ width: 32, height: 28, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
                aria-label="Edit color"
              />
              {c.isCustom ? (
                <button onClick={() => remove(c.id)} disabled={busy} type="button" className="btn-ghost" style={{ padding: 6, color: "var(--danger)" }} aria-label="Delete">
                  <Icon name="archive" color="var(--danger)" size={14} />
                </button>
              ) : (
                <span className="pill" style={{ fontSize: 10 }}>built-in</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
