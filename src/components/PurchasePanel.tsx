"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

type ResearchInfo = {
  isPurchase: boolean;
  purchaseDescription: string | null;
  researchStatus: "pending" | "running" | "done" | "error" | null;
  researchResult: string | null;
  researchError: string | null;
  researchedAt: string | null;
  configured: boolean;
};

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Renders plain text with clickable links; never injects HTML. */
export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: "var(--ink)", overflowWrap: "anywhere" }}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        const m = part.match(/^(.*?)([.,;:)\]]*)$/);
        const url = m?.[1] ?? part;
        const tail = m?.[2] ?? "";
        let label = url;
        try {
          const u = new URL(url);
          const path = u.pathname.length > 1 ? u.pathname.slice(0, 32) + (u.pathname.length > 32 ? "…" : "") : "";
          label = u.hostname.replace(/^www\./, "") + path;
        } catch {
          /* keep raw */
        }
        return (
          <span key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--terracotta-deep)", fontWeight: 700 }}>
              {label}
            </a>
            {tail}
          </span>
        );
      })}
    </div>
  );
}

export function PurchasePanel({ choreId, onChanged }: { choreId: string; onChanged: () => void }) {
  const [info, setInfo] = useState<ResearchInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [descDirty, setDescDirty] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [resultDraft, setResultDraft] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/chores/${choreId}/research`, { cache: "no-store" });
    if (!res.ok) return;
    const j: ResearchInfo = await res.json();
    setInfo(j);
    setDescDraft((prev) => (descDirty ? prev : j.purchaseDescription ?? ""));
  }, [choreId, descDirty]);

  useEffect(() => {
    void load();
  }, [load]);

  const working = info?.researchStatus === "pending" || info?.researchStatus === "running";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [working, load]);

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/chores/${choreId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Save failed");
  }

  async function startResearch() {
    const res = await fetch(`/api/chores/${choreId}/research`, { method: "POST" });
    if (!res.ok && res.status !== 409) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Could not start research");
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;

  if (!info.isPurchase) {
    return (
      <Box label="Purchase">
        {!converting ? (
          <button type="button" className="btn btn-ghost" onClick={() => setConverting(true)} style={{ alignSelf: "flex-start", fontSize: 13 }}>
            <Icon name="cart" color="var(--ink-2)" size={16} /> Make it a purchase
          </button>
        ) : (
          <>
            <textarea
              className="input"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="What are we looking for?"
              style={{ minHeight: 72, fontSize: 13, resize: "vertical", paddingTop: 10 }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() =>
                  run(async () => {
                    await patch({ isPurchase: true, purchaseDescription: descDraft.trim() || null, icon: "cart" });
                    await startResearch();
                    setConverting(false);
                  })
                }
              >
                Save &amp; research
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConverting(false)} style={{ padding: "6px 14px", fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </>
        )}
        {err && <ErrLine text={err} />}
      </Box>
    );
  }

  return (
    <Box label="Purchase">
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>What are we looking for</div>
      <textarea
        className="input"
        value={descDraft}
        onChange={(e) => {
          setDescDraft(e.target.value);
          setDescDirty(true);
        }}
        placeholder="Describe what you need"
        disabled={busy}
        style={{ minHeight: 56, fontSize: 13, resize: "vertical", paddingTop: 10 }}
      />
      {descDirty && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || working}
            style={{ padding: "4px 12px", fontSize: 12 }}
            onClick={() =>
              run(async () => {
                await patch({ purchaseDescription: descDraft.trim() || null });
                setDescDirty(false);
                await startResearch();
              })
            }
          >
            Save &amp; research again
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            style={{ padding: "4px 12px", fontSize: 12 }}
            onClick={() =>
              run(async () => {
                await patch({ purchaseDescription: descDraft.trim() || null });
                setDescDirty(false);
              })
            }
          >
            Save only
          </button>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", marginTop: 6 }}>Suggestions</div>
      {!info.configured && (
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>The research agent is not configured yet (missing Anthropic API key on the server).</div>
      )}
      {working && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>
          <Icon name="sparkles" color="var(--terracotta)" size={16} />
          Researching… this takes a few minutes. You can close this and come back.
        </div>
      )}
      {info.researchStatus === "error" && <ErrLine text={info.researchError ?? "Research failed"} />}
      {info.researchResult && !working && !editingResult && (
        <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 12, padding: 12 }}>
          <LinkifiedText text={info.researchResult} />
          {info.researchedAt && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>Researched {new Date(info.researchedAt).toLocaleString()}</div>
          )}
        </div>
      )}
      {editingResult && (
        <>
          <textarea
            className="input"
            value={resultDraft}
            onChange={(e) => setResultDraft(e.target.value)}
            style={{ minHeight: 220, fontSize: 13, resize: "vertical", paddingTop: 10 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={() =>
                run(async () => {
                  await patch({ researchResult: resultDraft });
                  setEditingResult(false);
                })
              }
            >
              Save
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setEditingResult(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
      {!working && !editingResult && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" disabled={busy} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => run(startResearch)}>
            <Icon name="sparkles" color="var(--ink-2)" size={14} /> {info.researchStatus ? "Research again" : "Start research"}
          </button>
          {info.researchResult && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={() => {
                setResultDraft(info.researchResult ?? "");
                setEditingResult(true);
              }}
            >
              Edit
            </button>
          )}
        </div>
      )}
      {err && <ErrLine text={err} />}
    </Box>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.06, color: "var(--ink-3)" }}>{label}</div>
      {children}
    </div>
  );
}

function ErrLine({ text }: { text: string }) {
  return <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 12 }}>{text}</div>;
}
