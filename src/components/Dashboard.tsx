"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { ChoreRow, type ChoreRowData } from "./ChoreRow";
import { AddChoreModal, type AddChorePrefill } from "./AddChoreModal";
import { AddEventModal, type ExistingEvent } from "./AddEventModal";
import { ChoreDetailModal } from "./ChoreDetailModal";
import { ThemeToggle } from "./ThemeToggle";
import { GoogleCalendarCard } from "./GoogleCalendarCard";
import { AllChoresView } from "./AllChoresView";
import { CategoriesEditor } from "./CategoriesEditor";
import { PushSubscribeCard } from "./PushSubscribeCard";
import { NotificationScheduleCard } from "./NotificationScheduleCard";
import { WeatherSettingsCard } from "./WeatherSettingsCard";
import { PurchaseRulesCard } from "./PurchaseRulesCard";
import { FamilyMembersCard } from "./FamilyMembersCard";
import { HouseholdAdminCard, InvitesCard } from "./HouseholdAdminCard";
import { CalendarView, type CalEvent } from "./CalendarView";
import { PullToRefresh } from "./PullToRefresh";
import { WeatherCard } from "./WeatherCard";
import { PersonLanes, WeekStrip } from "./PersonLanes";
import { type AssigneeSlug, type PriorityKey, type Category } from "../lib/catalog";
import { CategoriesProvider, useCategories } from "./CategoriesContext";
import { FamilyMembersProvider, useFamilyMembers, type Member } from "./FamilyMembersContext";

import { helloFor, isSameDay, startOfDay } from "../lib/date";
import { formatRecurrence } from "../lib/recurrence";
import type { RecurrenceUnit } from "@prisma/client";

type ApiChore = {
  id: string;
  title: string;
  notes: string | null;
  icon: string;
  category: string;
  priority: PriorityKey;
  assignee: { slug: string; name: string } | null;
  assignees?: Array<{ member: { slug: string; name: string; color: string; initials: string } }>;
  dueDate: string | null;
  isRecurring: boolean;
  recurInterval: number | null;
  recurUnit: RecurrenceUnit | null;
  recurDaysOfWeek: string | null;
  status: "active" | "completed" | "archived";
  completedAt: string | null;
  important: boolean;
  reminderAt: string | null;
  isPurchase?: boolean;
};

type Template = {
  id: string;
  title: string;
  icon: string;
  category: string;
  priority: PriorityKey;
  defaultRecurInterval: number | null;
  defaultRecurUnit: RecurrenceUnit | null;
  seasonal: boolean;
};

type Stats = {
  today: { done: number; total: number };
  week: { done: number; total: number };
  perMember: Array<{ id: string; slug: string; name: string; color: string; count: number }>;
  streak: number;
  score: number;
};


function toRowData(c: ApiChore): ChoreRowData {
  const slugs = c.assignees && c.assignees.length > 0
    ? c.assignees.map((a) => a.member.slug)
    : c.assignee?.slug
      ? [c.assignee.slug]
      : [];
  const primary = (slugs[0] ?? "unassigned") as AssigneeSlug;
  return {
    id: c.id,
    title: c.title,
    icon: c.icon,
    category: c.category,
    priority: c.priority,
    assigneeSlug: primary,
    assigneeSlugs: slugs,
    dueDate: c.dueDate,
    isRecurring: c.isRecurring,
    recurInterval: c.recurInterval,
    recurUnit: c.recurUnit,
    recurDaysOfWeek: c.recurDaysOfWeek,
    done: c.status === "completed",
    important: !!c.important,
    reminderAt: c.reminderAt ?? null,
    notes: c.notes ?? null,
    isPurchase: !!c.isPurchase
  };
}

export function Dashboard() {
  const [chores, setChores] = useState<ApiChore[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [categories, setCategories] = useState<Category[] | null>(null);
  type Me = {
    user: { name: string | null; email: string } | null;
    household: { id: string; name: string; members: Array<{ id: string; name: string; role: string }> } | null;
    isKiosk: boolean;
    isSuperAdmin: boolean;
  };
  const [me, setMe] = useState<Me | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<AddChorePrefill | null>(null);
  const [opened, setOpened] = useState<ChoreRowData | null>(null);
  const [editingEvent, setEditingEvent] = useState<ExistingEvent | null>(null);
  const [tab, _setTab] = useState<"home" | "calendar" | "all" | "templates" | "settings">("home");
  type Tab = "home" | "calendar" | "all" | "templates" | "settings";
  const setTab = useCallback((next: Tab) => {
    _setTab((prev) => {
      if (prev === next) return prev;
      try {
        if (typeof window !== "undefined") {
          window.history.pushState({ familyosTab: next }, "", `#${next}`);
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const [isWide, setIsWide] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsWide(mq.matches);
    const fn = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Cmd/Ctrl+K → open Add Chore modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAdding({});
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Push a history entry whenever a modal opens, so the back button closes it.
  useEffect(() => {
    if (adding || opened) {
      try {
        window.history.pushState({ familyosModal: true }, "", window.location.hash || "#home");
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, opened]);

  // Sync initial tab from URL hash, listen to back/forward navigation.
  useEffect(() => {
    function readHash(): Tab | null {
      const h = window.location.hash.replace(/^#/, "");
      if (h === "home" || h === "calendar" || h === "all" || h === "templates" || h === "settings") return h;
      return null;
    }
    const initial = readHash();
    if (initial) _setTab(initial);
    else window.history.replaceState({ familyosTab: "home" }, "", "#home");

    const onPop = () => {
      // If a modal is open, close the topmost one first.
      if (opened) {
        setOpened(null);
        return;
      }
      if (adding) {
        setAdding(null);
        return;
      }
      const t = readHash() ?? "home";
      _setTab(t);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, adding]);

  const load = useCallback(async () => {
    const [cRes, tRes, sRes, eRes, catRes, meRes, memRes] = await Promise.all([
      fetch("/api/chores?status=all", { cache: "no-store" }),
      fetch("/api/templates", { cache: "no-store" }),
      fetch("/api/stats", { cache: "no-store" }),
      fetch("/api/calendar/events", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/me", { cache: "no-store" }),
      fetch("/api/family-members", { cache: "no-store" })
    ]);
    if (meRes.ok) setMe(await meRes.json());
    if (memRes.ok) setFamilyMembers((await memRes.json()).members);
    if (cRes.ok) setChores((await cRes.json()).chores);
    if (tRes.ok) setTemplates((await tRes.json()).templates);
    if (sRes.ok) setStats(await sRes.json());
    if (eRes.ok) setEvents((await eRes.json()).events);
    if (catRes.ok) {
      const data = await catRes.json();
      type ApiCategory = { slug: string; label: string; icon: string; color: string; colorSoft: string };
      const mapped: Category[] = (data.categories as ApiCategory[]).map((c) => ({
        id: c.slug,
        label: c.label,
        icon: c.icon,
        color: c.color,
        soft: c.colorSoft
      }));
      setCategories(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-pull family members when CRUD elsewhere edits them, so AddChoreModal
  // + Kids Mode see new kids/adults without a full page reload.
  useEffect(() => {
    const onChange = async () => {
      try {
        const res = await fetch("/api/family-members", { cache: "no-store" });
        if (res.ok) setFamilyMembers((await res.json()).members);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("familyos-members-changed", onChange);
    return () => window.removeEventListener("familyos-members-changed", onChange);
  }, []);

  const hello = helloFor();
  const today = new Date();
  const todayChores = useMemo(
    () => chores.filter((c) => c.status !== "archived" && c.dueDate && isSameDay(new Date(c.dueDate), today)),
    [chores]
  );
  const completedToday = todayChores.filter((c) => c.status === "completed").length;
  const remainingToday = todayChores.length - completedToday;
  const upcoming = useMemo(
    () =>
      chores
        .filter((c) => c.status === "active" && c.dueDate && new Date(c.dueDate) > startOfDay(today))
        .slice(0, 5),
    [chores]
  );
  const recurringNext = useMemo(() => {
    // One row per recurring series — group by normalized title so a daily chore
    // doesn't list every overdue instance separately.
    const seen = new Set<string>();
    const out: ApiChore[] = [];
    for (const c of chores) {
      if (!c.isRecurring || c.status === "archived") continue;
      const key = c.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [chores]);
  const importantTasks = useMemo(
    () => chores.filter((c) => c.important && c.status !== "archived"),
    [chores]
  );

  async function toggle(id: string, done: boolean) {
    setChores((cs) => cs.map((c) => (c.id === id ? { ...c, status: done ? "completed" : "active" } : c)));
    await fetch(`/api/chores/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ undo: !done })
    });
    load();
  }

  async function toggleImportant(id: string, next: boolean) {
    setChores((cs) => cs.map((c) => (c.id === id ? { ...c, important: next } : c)));
    await fetch(`/api/chores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ important: next })
    });
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const dateLabel = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <CategoriesProvider value={categories}>
    <FamilyMembersProvider value={familyMembers}>
    <div className={`tod-${hello.tod}`} style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Header dateLabel={dateLabel} onLogout={logout} householdName={me?.household?.name ?? "Family"} showAdmin={!!me?.isSuperAdmin} nav={isWide ? { active: tab, setActive: setTab, onAdd: () => setAdding({}) } : null} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        <PullToRefresh
          onRefresh={load}
          className="scroll"
          style={{ flex: 1, padding: isWide ? "24px 36px 60px" : "12px 16px 84px", minWidth: 0 }}
        >
          {tab === "home" && (
            <Home
              isWide={isWide}
              hello={hello}
              dateLabel={dateLabel}
              stats={stats}
              chores={chores.filter((c) => c.status !== "archived").map(toRowData)}
              remainingToday={remainingToday}
              upcoming={upcoming.map(toRowData)}
              recurringNext={recurringNext}
              events={events}
              importantTasks={importantTasks.map(toRowData)}
              loading={loading}
              onToggle={toggle}
              onOpen={(c) => setOpened(c)}
              onAdd={() => setAdding({})}
              onToggleImportant={toggleImportant}
              onEventClick={(e) =>
                setEditingEvent({
                  id: e.id,
                  title: e.title,
                  description: null,
                  startsAt: e.startsAt,
                  endsAt: e.endsAt,
                  allDay: e.allDay,
                  persona: e.persona ?? null
                })
              }
            />
          )}
          {tab === "calendar" && <CalendarView events={events} onChanged={load} isWide={isWide} />}
          {tab === "all" && (
            <AllChoresView
              chores={chores.filter((c) => c.status !== "archived").map(toRowData)}
              isWide={isWide}
              onToggle={toggle}
              onOpen={(c) => setOpened(c)}
              onToggleImportant={toggleImportant}
            />
          )}
          {tab === "templates" && (
            <Templates
              templates={templates}
              isWide={isWide}
              onPick={(t) =>
                setAdding({
                  title: t.title,
                  icon: t.icon,
                  category: t.category,
                  priority: t.priority,
                  recurInterval: t.defaultRecurInterval ?? undefined,
                  recurUnit: t.defaultRecurUnit ?? undefined
                })
              }
            />
          )}
          {tab === "settings" && <Settings />}
        </PullToRefresh>
      </div>

      {!isWide && <MobileTabBar active={tab} setActive={setTab} onAdd={() => setAdding({})} />}

      {adding && <AddChoreModal onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} prefill={adding} />}
      {opened && <ChoreDetailModal chore={opened} onClose={() => setOpened(null)} onChanged={load} />}
      {editingEvent && (
        <AddEventModal
          existing={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            load();
          }}
        />
      )}
    </div>
    </FamilyMembersProvider>
    </CategoriesProvider>
  );
}

type TabKey = "home" | "calendar" | "all" | "templates" | "settings";
type HeaderNav = { active: TabKey; setActive: (k: TabKey) => void; onAdd: () => void };

const TOP_NAV: Array<{ id: TabKey; label: string }> = [
  { id: "home", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "all", label: "All chores" },
  { id: "templates", label: "Templates" },
  { id: "settings", label: "Settings" }
];

function Header({
  dateLabel,
  onLogout,
  householdName,
  showAdmin,
  nav
}: {
  dateLabel: string;
  onLogout: () => void;
  householdName: string;
  showAdmin: boolean;
  nav: HeaderNav | null;
}) {
  const members = useFamilyMembers();
  const hasKids = useMemo(() => members.some((m) => m.isPerson && m.isChild), [members]);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const fn = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "14px 16px 8px" : nav ? "12px 28px" : "20px 24px 12px",
        gap: 12,
        background: nav ? "var(--surface)" : "transparent",
        borderBottom: nav ? "1px solid var(--line)" : "none"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: isMobile ? 38 : 44,
            height: isMobile ? 38 : 44,
            borderRadius: 12,
            background: "var(--terracotta)",
            display: "grid",
            placeItems: "center",
            boxShadow: "var(--shadow)",
            flexShrink: 0
          }}
        >
          <Icon name="home" color="white" accent="rgba(255,255,255,0.6)" size={isMobile ? 22 : 26} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: -0.01, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>FamilyOS</h1>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {householdName}
          </p>
        </div>
      </div>
      {nav && (
        <nav aria-label="Main" style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, marginLeft: 24 }}>
          {TOP_NAV.map((it) => {
            const sel = nav.active === it.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => nav.setActive(it.id)}
                aria-current={sel ? "page" : undefined}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  color: sel ? "var(--ink)" : "var(--ink-3)",
                  background: sel ? "var(--surface-2)" : "transparent",
                  boxShadow: sel ? "inset 0 -2px 0 var(--terracotta)" : "none"
                }}
              >
                {it.label}
              </button>
            );
          })}
          <button type="button" onClick={nav.onAdd} className="btn btn-primary" style={{ marginLeft: 8, padding: "8px 14px", fontSize: 13 }}>
            <Icon name="plus" color="white" size={14} /> New
          </button>
        </nav>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
        {!isMobile && !nav && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--olive)" }} />
            {dateLabel}
          </span>
        )}

        {hasKids && (
          <a
            href="/kids"
            className="btn btn-ghost"
            aria-label="Kids Mode"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
              background: "var(--terracotta-soft)",
              color: "var(--terracotta-deep)",
              padding: isMobile ? "8px 12px" : undefined
            }}
          >
            <Icon name="star" color="var(--terracotta-deep)" accent="rgba(255,255,255,0.6)" size={isMobile ? 16 : 14} />
            {isMobile ? null : "Kids"}
          </a>
        )}

        {isMobile ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="btn-ghost"
              style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.04)"
              }}
            >
              <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
                <span style={{ width: 4, height: 4, borderRadius: 99, background: "var(--ink-2)" }} />
                <span style={{ width: 4, height: 4, borderRadius: 99, background: "var(--ink-2)" }} />
                <span style={{ width: 4, height: 4, borderRadius: 99, background: "var(--ink-2)" }} />
              </span>
            </button>
            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  zIndex: 30,
                  minWidth: 180,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  boxShadow: "var(--shadow-lg)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>
                  <ThemeToggle compact />
                </div>
                {showAdmin && (
                  <a
                    href="/admin"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      textDecoration: "none",
                      color: "var(--ink)",
                      fontWeight: 700,
                      fontSize: 14,
                      borderBottom: "1px solid var(--line)"
                    }}
                  >
                    <Icon name="settings" color="var(--ink-2)" size={16} /> Admin
                  </a>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "transparent",
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <Icon name="user" color="var(--ink-2)" size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ThemeToggle compact />
            {showAdmin && (
              <a
                href="/admin"
                className="btn btn-ghost"
                aria-label="Super admin"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                  background: "var(--ink)",
                  color: "white"
                }}
              >
                <Icon name="settings" color="white" size={14} /> Admin
              </a>
            )}
            <button onClick={onLogout} className="btn btn-ghost" aria-label="Log out" type="button">
              <Icon name="user" color="var(--ink-2)" size={14} /> Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function MobileTabBar({
  active,
  setActive,
  onAdd
}: {
  active: string;
  setActive: (k: "home" | "calendar" | "all" | "templates" | "settings") => void;
  onAdd: () => void;
}) {
  const items: Array<{ id: "home" | "calendar" | "all" | "templates" | "settings"; icon: string; label: string }> = [
    { id: "home", icon: "home", label: "Home" },
    { id: "all", icon: "archive", label: "All" },
    { id: "calendar", icon: "calendar", label: "Calendar" },
    { id: "settings", icon: "settings", label: "Settings" }
  ];
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "8px 12px calc(env(safe-area-inset-bottom, 0px) + 4px)",
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 30
      }}
    >
      {items.slice(0, 2).map((it) => (
        <TabBtn key={it.id} item={it} active={active === it.id} onClick={() => setActive(it.id)} />
      ))}
      <button
        onClick={onAdd}
        type="button"
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: "var(--terracotta)",
          color: "white",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 6px 16px var(--accent-glow)",
          marginTop: -18
        }}
        aria-label="Add chore"
      >
        <Icon name="plus" color="white" size={26} />
      </button>
      {items.slice(2).map((it) => (
        <TabBtn key={it.id} item={it} active={active === it.id} onClick={() => setActive(it.id)} />
      ))}
    </nav>
  );
}

function TabBtn({ item, active, onClick }: { item: { icon: string; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "6px 4px",
        minWidth: 56,
        color: active ? "var(--terracotta)" : "var(--ink-3)"
      }}
    >
      <Icon name={item.icon} color={active ? "var(--terracotta)" : "var(--ink-3)"} accent={active ? "var(--terracotta-deep)" : "var(--ink-4)"} size={22} />
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.04 }}>{item.label}</span>
    </button>
  );
}

type HomeProps = {
  isWide: boolean;
  hello: ReturnType<typeof helloFor>;
  dateLabel: string;
  stats: Stats | null;
  chores: ChoreRowData[];
  remainingToday: number;
  upcoming: ChoreRowData[];
  recurringNext: ApiChore[];
  events: CalEvent[];
  importantTasks: ChoreRowData[];
  loading: boolean;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (c: ChoreRowData) => void;
  onAdd: () => void;
  onToggleImportant: (id: string, next: boolean) => void;
  onEventClick: (e: CalEvent) => void;
};

/** Home = the family board: a week strip and one lane per person for the picked day. */
function Home(p: HomeProps) {
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const isToday = isSameDay(day, new Date());
  const openThatDay = useMemo(
    () => p.chores.filter((c) => !c.done && c.dueDate && isSameDay(new Date(c.dueDate), day)).length,
    [p.chores, day]
  );
  const dayLabel = isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const summary = isToday
    ? p.remainingToday > 0
      ? `${p.remainingToday} left today`
      : "All done for today"
    : openThatDay > 0
      ? `${openThatDay} planned`
      : "Nothing planned";

  const lanes = p.loading && p.chores.length === 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SkeletonRow dense />
      <SkeletonRow dense />
    </div>
  ) : (
    <PersonLanes chores={p.chores} day={day} columns={p.isWide} onToggle={p.onToggle} onOpen={p.onOpen} />
  );

  const important = p.importantTasks.length > 0 && (
    <div className="card" style={{ padding: p.isWide ? 18 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="star" color="var(--sand)" size={18} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Important right now</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {p.importantTasks.map((c) => (
          <ChoreRow key={c.id} chore={c} onToggle={p.onToggle} onOpen={p.onOpen} onToggleImportant={p.onToggleImportant} dense />
        ))}
      </div>
    </div>
  );

  const repeats = (
    <div className="card" style={{ padding: p.isWide ? 18 : 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Repeats</h2>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Auto-scheduled</span>
      </div>
      <RecurringList rows={p.isWide ? p.recurringNext.slice(0, 8) : p.recurringNext} dense />
    </div>
  );

  if (!p.isWide) {
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{dayLabel}</h1>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{summary}</span>
        </div>
        <WeekStrip chores={p.chores} selected={day} onSelect={setDay} />
        {lanes}
        {important}
        <WeatherCard compact />
        {repeats}
      </div>
    );
  }

  const week = p.stats?.week ?? { done: 0, total: 0 };
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--ink-3)", fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", fontSize: 12 }}>{p.dateLabel}</div>
          <h1 style={{ margin: "2px 0 4px", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {isToday ? `${p.hello.greeting}` : dayLabel}
          </h1>
          <div className="muted" style={{ fontSize: 15, fontWeight: 600 }}>
            {summary} · this week {week.done}/{week.total} done
          </div>
        </div>
        <button onClick={p.onAdd} className="btn btn-primary" style={{ padding: "12px 20px", fontSize: 15 }} type="button">
          <Icon name="plus" color="white" size={18} /> Add chore
        </button>
      </div>

      <div style={{ maxWidth: 620 }}>
        <WeekStrip chores={p.chores} selected={day} onSelect={setDay} />
      </div>

      {lanes}
      {important}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minWidth: 0 }}>
          <div className="card" style={{ padding: 18 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Coming up</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {p.upcoming.length === 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nothing scheduled yet.</p>}
              {p.upcoming.slice(0, 5).map((c) => (
                <ChoreRow key={c.id} chore={c} onToggle={p.onToggle} onOpen={p.onOpen} onToggleImportant={p.onToggleImportant} dense />
              ))}
            </div>
          </div>
          {repeats}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <WeatherCard compact />
          <WhatsOnCard events={p.events} chores={p.chores} onEventClick={p.onEventClick} onChoreOpen={p.onOpen} />
        </div>
      </div>
    </div>
  );
}


function RecurringList({ rows, dense }: { rows: ApiChore[]; dense?: boolean }) {
  if (rows.length === 0) {
    return <p className="muted" style={{ fontSize: 13 }}>No recurring chores yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: dense ? 4 : 6 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: dense ? "6px 0" : "8px 0", borderBottom: dense ? "none" : "1px solid var(--line)" }}>
          <span style={{ width: dense ? 30 : 36, height: dense ? 30 : 36, borderRadius: 10, background: "var(--surface)", display: "grid", placeItems: "center" }}>
            <Icon name={r.icon} color="var(--olive)" size={dense ? 16 : 18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: dense ? 13 : 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
            <div className="muted" style={{ fontSize: dense ? 11 : 12 }}>
              {r.recurInterval && r.recurUnit
                ? formatRecurrence({ interval: r.recurInterval, unit: r.recurUnit, daysOfWeek: r.recurDaysOfWeek ? r.recurDaysOfWeek.split(",") : undefined })
                : "—"}
            </div>
          </div>
          <Avatar who={(r.assignee?.slug ?? "unassigned") as AssigneeSlug} size={dense ? 22 : 26} />
        </div>
      ))}
    </div>
  );
}

function EventList({ events, onEventClick }: { events: CalEvent[]; onEventClick?: (e: CalEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="card-flat" style={{ padding: 14, borderRadius: 14, borderLeft: "4px solid var(--blue)" }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          No upcoming events. Connect Google Calendar in Settings.
        </span>
      </div>
    );
  }
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    const key = d.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from(groups.entries()).map(([key, list]) => {
        const d = new Date(key);
        const isToday = new Date().toDateString() === key;
        const label = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.1, color: "var(--ink-3)" }}>{label}</span>
            {list.map((e) => {
              const s = new Date(e.startsAt);
              const timeLabel = e.allDay
                ? "All day"
                : s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEventClick?.(e)}
                  disabled={!onEventClick}
                  style={{
                    display: "flex",
                    padding: "10px 12px",
                    background: "var(--surface-2)",
                    borderRadius: 14,
                    borderLeft: `4px solid ${e.color ?? "var(--blue)"}`,
                    gap: 12,
                    alignItems: "center",
                    textAlign: "left",
                    cursor: onEventClick ? "pointer" : "default",
                    width: "100%"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{timeLabel} · {e.calendar ?? e.source}</div>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

type WhatsOnFilter = "events" | "chores" | "both";

function WhatsOnCard({
  events,
  chores,
  onEventClick,
  onChoreOpen
}: {
  events: CalEvent[];
  chores: ChoreRowData[];
  onEventClick: (e: CalEvent) => void;
  onChoreOpen: (c: ChoreRowData) => void;
}) {
  const [filter, setFilter] = useState<WhatsOnFilter>("events");

  type Item =
    | { kind: "event"; key: string; date: Date; allDay: boolean; payload: CalEvent }
    | { kind: "chore"; key: string; date: Date; allDay: boolean; payload: ChoreRowData };

  const items = useMemo((): Item[] => {
    const out: Item[] = [];
    if (filter !== "chores") {
      for (const e of events) {
        out.push({ kind: "event", key: `e-${e.id}`, date: new Date(e.startsAt), allDay: e.allDay, payload: e });
      }
    }
    if (filter !== "events") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const c of chores) {
        if (!c.dueDate) continue;
        const d = new Date(c.dueDate);
        if (d.getTime() < today.getTime() - 86400_000) continue; // skip ancient
        out.push({ kind: "chore", key: `c-${c.id}`, date: d, allDay: true, payload: c });
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 30);
  }, [events, chores, filter]);

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      const k = i.date.toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return Array.from(m.entries());
  }, [items]);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", maxHeight: 640, minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0, gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>What&apos;s on</h2>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 99 }}>
          {(["events", "chores", "both"] as WhatsOnFilter[]).map((f) => {
            const sel = filter === f;
            const label = f === "events" ? "Events" : f === "chores" ? "Chores" : "Both";
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 99,
                  background: sel ? "var(--surface)" : "transparent",
                  color: sel ? "var(--ink)" : "var(--ink-3)",
                  fontWeight: 700,
                  fontSize: 12,
                  boxShadow: sel ? "var(--shadow-sm)" : "none"
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {items.length === 0 ? (
          <div className="card-flat" style={{ padding: 14, borderRadius: 14, borderLeft: "4px solid var(--blue)" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              {filter === "chores" ? "No chores scheduled." : filter === "events" ? "No upcoming events." : "Nothing on the calendar."}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map(([key, list]) => {
              const d = new Date(key);
              const isToday = new Date().toDateString() === key;
              const label = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.1, color: "var(--ink-3)" }}>{label}</span>
                  {list.map((i) =>
                    i.kind === "event" ? (
                      <WhatsOnEvent key={i.key} event={i.payload} onClick={() => onEventClick(i.payload)} />
                    ) : (
                      <WhatsOnChore key={i.key} chore={i.payload} onClick={() => onChoreOpen(i.payload)} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsOnEvent({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const s = new Date(event.startsAt);
  const time = event.allDay ? "All day" : s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        padding: "10px 12px",
        background: "var(--surface-2)",
        borderRadius: 14,
        borderLeft: `4px solid ${event.color ?? "var(--blue)"}`,
        gap: 12,
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
        width: "100%"
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>{time} · {event.calendar ?? event.source}</div>
      </div>
    </button>
  );
}

function WhatsOnChore({ chore, onClick }: { chore: ChoreRowData; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        padding: "10px 12px",
        background: "var(--terracotta-soft)",
        borderRadius: 14,
        borderLeft: `4px solid var(--terracotta)`,
        gap: 12,
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        opacity: chore.done ? 0.6 : 1
      }}
    >
      <Icon name={chore.icon} color="var(--terracotta-deep)" size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: chore.done ? "line-through" : "none" }}>
          {chore.title}
        </div>
        <div className="muted" style={{ fontSize: 12, color: "var(--terracotta-deep)" }}>
          Chore · {chore.priority}
        </div>
      </div>
    </button>
  );
}

function SkeletonRow({ dense = false }: { dense?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: dense ? 12 : 16,
        padding: dense ? "12px 14px" : "18px 18px",
        background: "var(--surface-2)",
        borderRadius: 24,
        border: "1px solid var(--line)",
        opacity: 0.55,
        animation: "pulseSoft 1.4s ease-in-out infinite"
      }}
    >
      <span style={{ width: dense ? 28 : 36, height: dense ? 28 : 36, borderRadius: 999, background: "var(--surface-3)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ height: 14, width: "60%", borderRadius: 6, background: "var(--surface-3)" }} />
        <span style={{ height: 10, width: "30%", borderRadius: 6, background: "var(--surface-3)" }} />
      </div>
      <span style={{ width: dense ? 26 : 32, height: dense ? 26 : 32, borderRadius: 999, background: "var(--surface-3)" }} />
    </div>
  );
}

// Inline placeholder replaced — the real CalendarView lives in ./CalendarView.tsx
// and is imported at the top of this file. This keeps the legacy EventList type local.


function Templates({ templates, isWide, onPick }: { templates: Template[]; isWide: boolean; onPick: (t: Template) => void }) {
  const categories = useCategories();
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Templates</span>
        <h1 style={{ margin: "4px 0", fontSize: isWide ? 32 : 24, fontWeight: 800 }}>Quick-add a chore</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Tap a tile to add it with sensible defaults.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isWide ? "repeat(4, 1fr)" : "1fr 1fr", gap: 14 }}>
        {templates.map((t) => {
          const cat = categories.find((c) => c.id === t.category);
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="card"
              type="button"
              style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}
            >
              <span style={{ width: 48, height: 48, borderRadius: 14, background: cat?.soft, display: "grid", placeItems: "center" }}>
                <Icon name={t.icon} color={cat?.color} size={24} />
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{t.title}</div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                  {t.defaultRecurInterval && t.defaultRecurUnit
                    ? `Suggests · ${formatRecurrence({ interval: t.defaultRecurInterval, unit: t.defaultRecurUnit })}`
                    : "One-off"}
                </div>
              </div>
              {t.seasonal && (
                <span className="pill" style={{ background: "var(--sand-soft)", color: "var(--sand)", alignSelf: "flex-start" }}>
                  <Icon name="sparkles" color="var(--sand)" size={11} /> Seasonal
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type SettingsSectionKey =
  | "family"
  | "categories"
  | "notifications"
  | "weather"
  | "purchases"
  | "calendar"
  | "account"
  | "integrations";

const SETTINGS_SECTIONS: Array<{ key: SettingsSectionKey; label: string; icon: string; desc: string }> = [
  { key: "family", label: "Household", icon: "users", desc: "Members, kids, roles" },
  { key: "categories", label: "Categories", icon: "layers", desc: "Tags + colors" },
  { key: "notifications", label: "Notifications", icon: "clock", desc: "Push + daily digest" },
  { key: "weather", label: "Weather", icon: "sun", desc: "Location + forecast" },
  { key: "purchases", label: "Purchases", icon: "cart", desc: "Rules for the research agent" },
  { key: "calendar", label: "Google Calendar", icon: "calendar", desc: "Sync events" },
  { key: "account", label: "Account", icon: "user", desc: "Password + session" },
  { key: "integrations", label: "Integrations", icon: "link", desc: "AI + other connectors" }
];

function Settings() {
  const [section, setSection] = useState<SettingsSectionKey>("family");
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    setIsWide(mq.matches);
    const fn = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const renderSection = (k: SettingsSectionKey) => {
    switch (k) {
      case "family":
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <HouseholdAdminCard />
            <InvitesCard />
            <FamilyMembersCard />
          </div>
        );
      case "categories":
        return <CategoriesEditor />;
      case "notifications":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PushSubscribeCard />
            <NotificationScheduleCard />
          </div>
        );
      case "weather":
        return <WeatherSettingsCard />;
      case "purchases":
        return <PurchaseRulesCard />;
      case "calendar":
        return <GoogleCalendarCard />;
      case "account":
        return (
          <SettingsCard title="Account" icon="user">
            <SettingsRow label="Email login" desc="Sign in with your email + bcrypt-hashed password" trailing={<span className="pill" style={{ background: "var(--olive-soft)", color: "var(--olive)" }}>Default</span>} />
            <SettingsRow label="Forgot password" desc="Receive a reset link by email at /forgot" trailing={<a href="/forgot" className="pill" style={{ background: "var(--terracotta-soft)", color: "var(--terracotta-deep)", textDecoration: "none" }}>Open</a>} />
          </SettingsCard>
        );
      case "integrations":
        return (
          <SettingsCard title="Integrations" icon="link">
            <SettingsRow label="Purchase research (Claude)" desc="AI agent that researches products for purchase chores. Needs ANTHROPIC_API_KEY on the server." trailing={<span className="pill">Optional</span>} />
            <SettingsRow label="OpenAI suggestions" desc="Smart icon / category / recurrence guesses on chore titles. Falls back to local rules if OPENAI_API_KEY is unset." trailing={<span className="pill">Optional</span>} />
            <SettingsRow label="Web Push (VAPID)" desc="Configured server-side. See Notifications for per-device controls." trailing={<span className="pill">Configured</span>} />
          </SettingsCard>
        );
    }
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Settings</span>
        <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 800 }}>Family preferences</h1>
      </div>

      {isWide ? (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, alignItems: "start" }}>
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 18,
              padding: 8,
              boxShadow: "var(--shadow-sm)",
              position: "sticky",
              top: 16
            }}
          >
            {SETTINGS_SECTIONS.map((s) => {
              const sel = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: sel ? "var(--surface-2)" : "transparent",
                    color: sel ? "var(--terracotta)" : "var(--ink)",
                    fontWeight: 700,
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                    border: "none"
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: sel ? "var(--terracotta-soft)" : "rgba(0,0,0,0.04)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Icon name={s.icon} color={sel ? "var(--terracotta-deep)" : "var(--ink-2)"} size={16} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span>{s.label}</span>
                    <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{s.desc}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {renderSection(section)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }} className="no-scrollbar">
            {SETTINGS_SECTIONS.map((s) => {
              const sel = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 99,
                    background: sel ? "var(--ink)" : "rgba(0,0,0,0.04)",
                    color: sel ? "var(--surface)" : "var(--ink-2)",
                    fontWeight: 800,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    border: "none"
                  }}
                >
                  <Icon name={s.icon} color={sel ? "var(--surface)" : "var(--ink-3)"} size={14} />
                  {s.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{renderSection(section)}</div>
        </div>
      )}
    </div>
  );
}

function SettingsCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Icon name={icon} color="var(--terracotta)" size={22} />
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsRow({ leading, label, desc, trailing }: { leading?: React.ReactNode; label: string; desc?: string; trailing?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
        {desc && <div className="muted" style={{ fontSize: 12 }}>{desc}</div>}
      </div>
      {trailing}
    </div>
  );
}
