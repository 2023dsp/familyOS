"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { useCategories } from "./CategoriesContext";
import { FamilyMembersProvider, useFamilyMembers, type Member } from "./FamilyMembersContext";

const CHEERS = [
  "Amazing!",
  "Way to go!",
  "High five!",
  "Nice one!",
  "You did it!",
  "Star moment!",
  "Superhero stuff!",
  "Look at you go!"
];

type ApiChore = {
  id: string;
  title: string;
  icon: string;
  category: string;
  status: "active" | "completed" | "archived";
  assignee: { slug: string } | null;
  assignees?: Array<{ member: { slug: string } }>;
};

function softFromHex(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return "rgba(60,45,25,0.06)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
}

function chorePersona(c: ApiChore, kidSlug: string): boolean {
  if (c.assignees && c.assignees.length > 0) {
    return c.assignees.some((a) => a.member.slug === kidSlug);
  }
  return c.assignee?.slug === kidSlug;
}

function KidTile({
  task,
  color,
  done,
  why,
  onTap
}: {
  task: { id: string; title: string; icon: string };
  color: string;
  done: boolean;
  why: string | null;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      type="button"
      style={{
        position: "relative",
        background: done ? "#F1EADE" : softFromHex(color),
        borderRadius: 32,
        padding: "28px 22px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        boxShadow: done ? "none" : `0 6px 0 ${color}22, 0 12px 28px rgba(80,60,40,0.08)`,
        border: done ? "2px dashed #C8B89A" : "none",
        transition: "transform 0.1s, box-shadow 0.15s",
        cursor: "pointer",
        opacity: done ? 0.6 : 1,
        minHeight: 260
      }}
      onMouseDown={(e) => {
        if (!done) e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
      }}
    >
      <div
        style={{
          width: 128,
          height: 128,
          borderRadius: 32,
          background: "white",
          display: "grid",
          placeItems: "center",
          boxShadow: done ? "none" : `inset 0 0 0 4px ${color}22`
        }}
      >
        <Icon name={task.icon} color={color} accent={done ? "#C8B89A" : color + "88"} size={80} />
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: done ? "#998870" : "#2B2620",
          lineHeight: 1.15,
          textDecoration: done ? "line-through" : "none"
        }}
      >
        {task.title}
      </div>
      {why && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: done ? "#998870" : color,
            lineHeight: 1.25,
            fontStyle: "italic",
            opacity: done ? 0.5 : 0.95
          }}
        >
          {why}
        </div>
      )}
      {done && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 99,
            background: "#7DA08A",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 10px rgba(125,160,138,0.4)"
          }}
        >
          <Icon name="check" color="white" size={20} />
        </div>
      )}
    </button>
  );
}

function StarBar({ count, total, color }: { count: number; total: number; color: string }) {
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 28,
            height: 28,
            display: "grid",
            placeItems: "center",
            transition: "transform 0.3s cubic-bezier(0.2,0.7,0.2,1.4)",
            transform: i < count ? "scale(1)" : "scale(0.7)"
          }}
        >
          <Icon
            name="star"
            color={i < count ? color : "rgba(0,0,0,0.1)"}
            accent={i < count ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.05)"}
            size={i < count ? 28 : 22}
          />
        </span>
      ))}
    </div>
  );
}

function Burst({ msg, color, onDone }: { msg: string; color: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  const starColors = ["#E59A89", "#7AA0C2", "#D9B36C", "#7DA08A", "#B086C2"];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(ellipse at center, rgba(255,255,255,0.92), rgba(255,255,255,0.4))",
        animation: "fadeIn 0.2s ease both"
      }}
    >
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = 140 + ((i * 23) % 90);
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const sz = 16 + ((i * 11) % 18);
        const delay = (i % 5) * 0.03;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: sz,
              height: sz,
              transform: "translate(-50%, -50%)",
              animation: `kidsBurst${i} 1.2s cubic-bezier(0.2,0.7,0.2,1) ${delay}s forwards`
            }}
          >
            <Icon name="star" color={starColors[i % 5]} accent="rgba(255,255,255,0.7)" size={sz} />
          </span>
        );
      })}
      <style>{`
        ${Array.from({ length: 16 })
          .map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const r = 140 + ((i * 23) % 90);
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            return `@keyframes kidsBurst${i} {
              0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
              25% { transform: translate(-50%, -50%) scale(1.4) rotate(20deg); opacity: 1; }
              100% { transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.4) rotate(120deg); opacity: 0; }
            }`;
          })
          .join("\n")}
        @keyframes kidsPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: "white",
          padding: "32px 48px",
          borderRadius: 32,
          boxShadow: "0 30px 80px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          animation: "kidsPop 0.35s cubic-bezier(0.2,0.7,0.2,1.4) both"
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: color,
            display: "grid",
            placeItems: "center",
            boxShadow: `0 12px 28px ${color}66`
          }}
        >
          <Icon name="check" color="white" size={56} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#2B2620" }}>{msg}</div>
      </div>
    </div>
  );
}

function KidsModeInner() {
  const router = useRouter();
  const members = useFamilyMembers();
  const categories = useCategories();
  const kids = useMemo(() => members.filter((m) => m.isPerson && m.isChild), [members]);
  const [activeKidSlug, setActiveKidSlug] = useState<string | null>(null);
  const [chores, setChores] = useState<ApiChore[]>([]);
  const [burst, setBurst] = useState<{ msg: string; color: string } | null>(null);
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});
  const [whyByTitle, setWhyByTitle] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("familyos-kids-why");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("familyos-kids-why", JSON.stringify(whyByTitle));
    } catch {
      /* ignore quota */
    }
  }, [whyByTitle]);

  useEffect(() => {
    const locale = typeof navigator !== "undefined" ? navigator.language : "en";
    const seen = new Set<string>();
    chores.forEach((c) => {
      const key = c.title.trim().toLowerCase();
      if (!key || seen.has(key) || whyByTitle[key]) return;
      seen.add(key);
      fetch("/api/kids/why", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: c.title, locale })
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => {
          if (j.why) setWhyByTitle((prev) => ({ ...prev, [key]: j.why }));
        })
        .catch(() => {});
    });
  }, [chores, whyByTitle]);

  useEffect(() => {
    if (kids.length > 0 && !activeKidSlug) setActiveKidSlug(kids[0].slug);
  }, [kids, activeKidSlug]);

  async function load() {
    const res = await fetch("/api/chores?status=active", { cache: "no-store" });
    if (res.ok) setChores((await res.json()).chores);
  }

  useEffect(() => {
    load();
  }, []);

  const kid = kids.find((k) => k.slug === activeKidSlug) ?? null;
  const kidChores = useMemo(() => {
    if (!kid) return [] as ApiChore[];
    return chores.filter((c) => chorePersona(c, kid.slug));
  }, [chores, kid]);

  const completed = kidChores.filter((c) => optimisticDone[c.id]).length;
  const total = kidChores.length;

  async function complete(id: string, color: string, title: string) {
    if (optimisticDone[id]) {
      setOptimisticDone((s) => ({ ...s, [id]: false }));
      await fetch(`/api/chores/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true })
      }).catch(() => {});
      load();
      return;
    }
    setOptimisticDone((s) => ({ ...s, [id]: true }));
    setBurst({ msg: CHEERS[Math.floor(Math.random() * CHEERS.length)], color });
    await fetch(`/api/chores/${id}/complete`, { method: "POST" }).catch(() => {});
    // Don't reload immediately — let the celebration play. List refreshes on exit/next view.
  }

  if (kids.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg, #FFF8EE 0%, #F8ECD9 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <Icon name="sparkles" color="#C97B5B" size={48} />
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: "16px 0 8px", color: "#2B2620" }}>No kids yet</h1>
          <p style={{ fontSize: 14, color: "#5C4F3F", margin: "0 0 24px" }}>
            Add household members marked as "kid" in Settings → Household to enable Kids Mode.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              padding: "12px 22px",
              borderRadius: 99,
              background: "white",
              boxShadow: "0 4px 12px rgba(80,60,40,0.1)",
              fontWeight: 800,
              fontSize: 14,
              color: "#5C4F3F"
            }}
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (!kid) return null;

  const greeting =
    total === 0
      ? "Nothing today — go play!"
      : completed === 0
        ? "Ready to start?"
        : completed < total
          ? `${completed} done · ${total - completed} more to go!`
          : "All done — you're a STAR!";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(160deg, #FFF8EE 0%, #F8ECD9 100%)",
        display: "flex",
        flexDirection: "column",
        paddingTop: 28,
        overflow: "hidden"
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 80,
          right: -40,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "radial-gradient(circle, #F4DBCE, transparent 70%)",
          pointerEvents: "none"
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: -80,
          left: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, #DCE7F2, transparent 70%)",
          pointerEvents: "none"
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 36px 16px",
          position: "relative",
          zIndex: 2,
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            padding: "12px 18px 12px 14px",
            borderRadius: 99,
            background: "white",
            boxShadow: "0 4px 12px rgba(80,60,40,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 800,
            fontSize: 14,
            color: "#5C4F3F"
          }}
        >
          <Icon name="back" color="#5C4F3F" size={18} /> Exit Kids Mode
        </button>

        <div
          style={{
            display: "flex",
            gap: 6,
            background: "white",
            padding: 6,
            borderRadius: 99,
            boxShadow: "0 4px 12px rgba(80,60,40,0.1)"
          }}
        >
          {kids.map((k) => {
            const sel = activeKidSlug === k.slug;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setActiveKidSlug(k.slug)}
                style={{
                  padding: "10px 22px 10px 10px",
                  borderRadius: 99,
                  background: sel ? k.color : "transparent",
                  color: sel ? "white" : "#5C4F3F",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                  fontSize: 16,
                  transition: "background 0.2s"
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 99,
                    background: sel ? "rgba(255,255,255,0.25)" : softFromHex(k.color),
                    display: "grid",
                    placeItems: "center",
                    fontSize: 15,
                    fontWeight: 900,
                    color: sel ? "white" : k.color
                  }}
                >
                  {k.initials}
                </span>
                {k.name}
              </button>
            );
          })}
        </div>

        <span style={{ width: 160 }} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 48px 18px",
          position: "relative",
          zIndex: 2,
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: kid.color,
              letterSpacing: 0.06,
              textTransform: "uppercase"
            }}
          >
            Hi {kid.name}!
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: "#2B2620", lineHeight: 1.05 }}>
            {greeting}
          </div>
        </div>
        {total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#8A7A65",
                letterSpacing: 0.08,
                textTransform: "uppercase"
              }}
            >
              Today's stars
            </div>
            <StarBar count={completed} total={total} color={kid.color} />
          </div>
        )}
      </div>

      <div
        className="scroll kids-grid-wrap"
        style={{
          flex: 1,
          padding: "8px 36px 36px",
          display: "flex",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
          overflowY: "auto"
        }}
      >
        <div
          className="kids-grid"
          style={{
            display: "grid",
            gap: 22,
            gridAutoRows: "min-content",
            width: "100%",
            maxWidth: 1200
          }}
        >
          {kidChores.map((c) => {
            const cat = categories.find((x) => x.id === c.category);
            const color = cat?.color ?? kid.color;
            const key = c.title.trim().toLowerCase();
            return (
              <KidTile
                key={c.id}
                task={{ id: c.id, title: c.title, icon: c.icon }}
                color={color}
                done={!!optimisticDone[c.id]}
                why={whyByTitle[key] ?? null}
                onTap={() => complete(c.id, color, c.title)}
              />
            );
          })}
          {total === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: 40,
                textAlign: "center",
                background: "rgba(255,255,255,0.5)",
                borderRadius: 32,
                border: "2px dashed #E0D2B8"
              }}
            >
              <Icon name="sparkles" color={kid.color} size={48} />
              <p style={{ fontSize: 18, fontWeight: 800, color: "#5C4F3F", marginTop: 12 }}>
                No chores for {kid.name} today.
              </p>
            </div>
          )}
        </div>
        <style>{`
          .kids-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          @media (max-width: 1100px) { .kids-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
          @media (max-width: 760px)  { .kids-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } }
          @media (max-width: 420px)  { .kids-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
        `}</style>
      </div>

      {completed === total && total > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: kid.color,
            color: "white",
            padding: "16px 28px",
            borderRadius: 99,
            fontWeight: 900,
            fontSize: 16,
            boxShadow: `0 16px 36px ${kid.color}66`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fadeIn 0.4s ease both"
          }}
        >
          <Icon name="trophy" color="white" size={22} />
          {kid.name} earned the daily badge!
        </div>
      )}

      {burst && <Burst msg={burst.msg} color={burst.color} onDone={() => setBurst(null)} />}
    </div>
  );
}

export function KidsMode({ initialMembers }: { initialMembers: Member[] }) {
  return (
    <FamilyMembersProvider value={initialMembers}>
      <KidsModeInner />
    </FamilyMembersProvider>
  );
}
