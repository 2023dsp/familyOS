"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Ring, Progress } from "./Ring";
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
import { FamilyMembersCard } from "./FamilyMembersCard";
import { HouseholdAdminCard, InvitesCard } from "./HouseholdAdminCard";
import { CalendarView, type CalEvent } from "./CalendarView";
import { PullToRefresh } from "./PullToRefresh";
import { WeatherCard } from "./WeatherCard";
import { type AssigneeSlug, type PriorityKey, type Category } from "../lib/catalog";
import { CategoriesProvider, useCategories } from "./CategoriesContext";
import { FamilyMembersProvider, useFamilyMembers, type Member } from "./FamilyMembersContext";

function deriveMySlug(me: { user: { name: string | null; email: string } | null } | null, members: Member[]): string | null {
  if (!me?.user) return null;
  const base = (me.user.name ?? me.user.email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const byName = members.find((m) => m.slug === base);
  if (byName) return byName.slug;
  const first = members.find((m) => m.isPerson);
  return first?.slug ?? null;
}
import { humanDue, helloFor, isSameDay, startOfDay } from "../lib/date";
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
    notes: c.notes ?? null
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
  const [filter, setFilter] = useState<"today" | "upcoming" | "mine" | "all">("today");
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
  const recurringNext = useMemo(
    () => chores.filter((c) => c.isRecurring && c.status !== "archived").slice(0, 6),
    [chores]
  );
  const importantTasks = useMemo(
    () => chores.filter((c) => c.important && c.status !== "archived"),
    [chores]
  );

  const mySlug = useMemo(() => deriveMySlug(me, familyMembers), [me, familyMembers]);

  const filtered = useMemo(() => {
    const base = chores.filter((c) => c.status !== "archived");
    if (filter === "today") return base.filter((c) => c.dueDate && isSameDay(new Date(c.dueDate), today));
    if (filter === "upcoming") return base.filter((c) => c.dueDate && new Date(c.dueDate) > startOfDay(today));
    if (filter === "mine") {
      if (!mySlug) return [] as ApiChore[];
      return base.filter((c) => {
        if (c.assignee?.slug === mySlug) return true;
        return (c.assignees ?? []).some((a) => a.member.slug === mySlug);
      });
    }
    return base;
  }, [chores, filter]);

  async function toggle(id: string, done: boolean) {
    setChores((cs) => cs.map((c) => (c.id === id ? { ...c, status: done ? "completed" : "active" } : c)));
    await fetch(`/api/chores/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ undo: !done })
    });
    load();
  }

  async function markAllDoneToday() {
    const ids = chores
      .filter((c) => c.status === "active" && c.dueDate && isSameDay(new Date(c.dueDate), new Date()))
      .map((c) => c.id);
    if (ids.length === 0) return;
    if (!confirm(`Mark ${ids.length} chore${ids.length === 1 ? "" : "s"} as done?`)) return;
    setChores((cs) =>
      cs.map((c) => (ids.includes(c.id) ? { ...c, status: "completed" as const } : c))
    );
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/chores/${id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        })
      )
    );
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
      <Header dateLabel={dateLabel} onLogout={logout} householdName={me?.household?.name ?? "Family"} showAdmin={!!me?.isSuperAdmin} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {isWide && <SideNav active={tab} setActive={setTab} onAdd={() => setAdding({})} />}
        <PullToRefresh
          onRefresh={load}
          className="scroll"
          style={{ flex: 1, padding: isWide ? "16px 36px 60px" : "12px 16px 76px", minWidth: 0 }}
        >
          {tab === "home" && (
            <Home
              isWide={isWide}
              hello={hello}
              dateLabel={dateLabel}
              stats={stats}
              chores={chores.map(toRowData)}
              todayChores={todayChores.map(toRowData)}
              mySlug={mySlug}
              completedToday={completedToday}
              remainingToday={remainingToday}
              upcoming={upcoming.map(toRowData)}
              recurringNext={recurringNext}
              filter={filter}
              setFilter={setFilter}
              filtered={filtered.map(toRowData)}
              events={events}
              householdName={me?.household?.name ?? (process.env.NEXT_PUBLIC_FAMILY_NAMES ?? "Family")}
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
              onMarkAllDone={markAllDoneToday}
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

function Header({ dateLabel, onLogout, householdName, showAdmin }: { dateLabel: string; onLogout: () => void; householdName: string; showAdmin: boolean }) {
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
        padding: isMobile ? "14px 16px 8px" : "20px 24px 12px",
        gap: 12
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: isMobile ? 38 : 44,
            height: isMobile ? 38 : 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--terracotta), var(--terracotta-deep))",
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
        {!isMobile && (
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

function SideNav({
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
    { id: "calendar", icon: "calendar", label: "Calendar" },
    { id: "all", icon: "archive", label: "All" },
    { id: "templates", icon: "layers", label: "Templates" },
    { id: "settings", icon: "settings", label: "Settings" }
  ];
  return (
    <nav
      style={{
        width: 96,
        padding: "8px 16px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
        height: "100%",
        overflowY: "auto"
      }}
    >
      <button
        onClick={onAdd}
        type="button"
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          background: "linear-gradient(135deg, var(--terracotta), var(--terracotta-deep))",
          color: "white",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 22px rgba(201,123,91,0.35)"
        }}
        aria-label="Add chore"
      >
        <Icon name="plus" color="white" size={28} />
      </button>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const sel = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setActive(it.id)}
              type="button"
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: sel ? "var(--surface)" : "transparent",
                color: sel ? "var(--terracotta)" : "var(--ink-3)",
                display: "grid",
                placeItems: "center",
                boxShadow: sel ? "var(--shadow-sm)" : "none",
                position: "relative",
                transition: "all 0.15s"
              }}
            >
              <Icon
                name={it.icon}
                color={sel ? "var(--terracotta)" : "var(--ink-3)"}
                accent={sel ? "var(--terracotta-deep)" : "var(--ink-4)"}
                size={26}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 4,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.08,
                  textTransform: "uppercase"
                }}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
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
        background: "linear-gradient(to top, var(--surface) 70%, transparent)",
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
          background: "linear-gradient(135deg, var(--terracotta), var(--terracotta-deep))",
          color: "white",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 6px 16px rgba(201,123,91,0.4)",
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
  todayChores: ChoreRowData[];
  mySlug: string | null;
  completedToday: number;
  remainingToday: number;
  upcoming: ChoreRowData[];
  recurringNext: ApiChore[];
  filter: "today" | "upcoming" | "mine" | "all";
  setFilter: (v: HomeProps["filter"]) => void;
  filtered: ChoreRowData[];
  events: CalEvent[];
  householdName: string;
  importantTasks: ChoreRowData[];
  loading: boolean;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (c: ChoreRowData) => void;
  onAdd: () => void;
  onToggleImportant: (id: string, next: boolean) => void;
  onEventClick: (e: CalEvent) => void;
  onMarkAllDone: () => void;
};

function Home(p: HomeProps) {
  return p.isWide ? <TabletHome {...p} /> : <MobileHome {...p} />;
}

type TodayView = "all" | "mine" | "adults";

function TabletHome(p: HomeProps) {
  const { hello, dateLabel, stats, todayChores, mySlug, completedToday, remainingToday, upcoming, recurringNext, importantTasks, loading, onToggle, onOpen, onAdd, onToggleImportant } = p;
  const members = useFamilyMembers();
  const kidSlugs = useMemo(() => new Set(members.filter((m) => m.isPerson && m.isChild).map((m) => m.slug)), [members]);
  const hasKids = kidSlugs.size > 0;
  // Default to "adults" when kids exist (kid chores live in /kids anyway and just distract here).
  // Members load async, so hasKids starts false — bump the default once they arrive,
  // unless the user already touched the toggle.
  const [todayView, setTodayView] = useState<TodayView>("all");
  const [todayViewTouched, setTodayViewTouched] = useState(false);
  useEffect(() => {
    if (todayViewTouched) return;
    setTodayView(hasKids ? "adults" : "all");
  }, [hasKids, todayViewTouched]);
  const pickTodayView = useCallback((next: TodayView) => {
    setTodayViewTouched(true);
    setTodayView(next);
  }, []);
  const visibleToday = useMemo(() => {
    return todayChores.filter((c) => {
      const slugs = c.assigneeSlugs && c.assigneeSlugs.length > 0 ? c.assigneeSlugs : [c.assigneeSlug];
      if (todayView === "mine") {
        if (!mySlug) return true;
        return slugs.includes(mySlug);
      }
      if (todayView === "adults") {
        // Hide only if EVERY assignee is a kid (kid-only chores).
        return slugs.some((s) => !kidSlugs.has(s));
      }
      return true;
    });
  }, [todayChores, todayView, mySlug, kidSlugs]);
  const visibleDone = visibleToday.filter((c) => c.done).length;
  const visibleTotal = visibleToday.length;
  const visibleRemaining = visibleTotal - visibleDone;
  const week = stats?.week ?? { done: 0, total: 0 };
  const score = stats?.score ?? 0;
  const streak = stats?.streak ?? 0;
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", fontSize: 13 }}>
            <Icon name={hello.emoji} color="var(--sand)" size={18} /> {dateLabel}
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 40, fontWeight: 800, letterSpacing: -0.02 }}>
            {hello.greeting}, <span style={{ color: "var(--terracotta)" }}>{p.householdName}</span>
          </h1>
          <div style={{ color: "var(--ink-3)", fontSize: 15, fontWeight: 600 }}>
            {visibleRemaining > 0 ? `${visibleRemaining} chores left today` : "All done — nice."}
          </div>
        </div>
        <button onClick={onAdd} className="btn btn-primary" style={{ padding: "14px 22px", fontSize: 15, borderRadius: 20 }} type="button">
          <Icon name="plus" color="white" size={18} /> Add chore
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 14 }}>
        <div className="card" style={{ background: "linear-gradient(135deg, var(--surface), var(--bg-2))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Today</span>
            <span className="pill" style={{ background: "var(--olive-soft)", color: "var(--olive)" }}>
              <Icon name="check" color="var(--olive)" size={12} /> {visibleDone}/{visibleTotal}
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Ring value={visibleDone} max={visibleTotal || 1} size={96} stroke={10} color="var(--olive)" label={`${visibleDone}/${visibleTotal}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
                {visibleRemaining > 0 ? `${visibleRemaining} to go` : "All done."}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {remainingToday > 0 ? "After coffee?" : "Home in order."}
              </div>
            </div>
          </div>
        </div>

        <WeatherCard compact />

        <div className="card">
          <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>This week</span>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>
            {week.done}
            <span className="muted" style={{ fontSize: 16, fontWeight: 700 }}> / {week.total}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>chores completed</div>
          <div style={{ marginTop: 14 }}>
            <Progress value={week.done} max={week.total || 1} color="var(--terracotta)" height={10} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, fontSize: 12, fontWeight: 700 }}>
            {stats?.perMember && stats.perMember.length > 0 ? (
              stats.perMember.slice(0, 4).map((m) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: m.color, color: "white", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  {m.name} · {m.count}
                </span>
              ))
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>No completions yet</span>
            )}
          </div>
        </div>

        <div className="card" style={{ background: "linear-gradient(160deg, var(--terracotta-soft), var(--surface))" }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>Household score</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: "var(--terracotta-deep)" }}>{score}</span>
            <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>/ 100</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
            <Icon name="fire" color="var(--terracotta)" size={18} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--terracotta-deep)" }}>
              {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
            </span>
          </div>
        </div>
      </div>

      {(importantTasks.length > 0 || loading) && (
        <div className="card" style={{ background: "linear-gradient(135deg, var(--terracotta-soft) 0%, var(--surface) 70%)", borderLeft: "6px solid var(--terracotta)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="sparkles" color="var(--terracotta-deep)" size={22} />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--terracotta-deep)" }}>Important right now</h2>
            </div>
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Big decisions · pin from any chore</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading && importantTasks.length === 0 && <SkeletonRow />}
            {!loading && importantTasks.length === 0 && (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing pinned. Pin chores from their detail view (the star button) to flag big decisions like &quot;School choice for Ellie&quot;.</p>
            )}
            {importantTasks.map((c) => (
              <ChoreRow key={c.id} chore={c} onToggle={onToggle} onOpen={onOpen} onToggleImportant={onToggleImportant} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Today&apos;s chores</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 99 }}>
                  {(
                    [
                      hasKids ? { key: "adults" as TodayView, label: "Adults" } : null,
                      { key: "all" as TodayView, label: "All" },
                      mySlug ? { key: "mine" as TodayView, label: "Mine" } : null
                    ].filter(Boolean) as Array<{ key: TodayView; label: string }>
                  ).map((opt) => {
                    const sel = todayView === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => pickTodayView(opt.key)}
                        style={{
                          padding: "5px 14px",
                          borderRadius: 99,
                          background: sel ? "var(--surface)" : "transparent",
                          color: sel ? "var(--ink)" : "var(--ink-3)",
                          fontWeight: 700,
                          fontSize: 12,
                          boxShadow: sel ? "var(--shadow-sm)" : "none"
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {visibleToday.some((c) => !c.done) ? (
                  <button
                    type="button"
                    onClick={p.onMarkAllDone}
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                  >
                    <Icon name="check" color="var(--olive)" size={14} /> Mark all done
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Tap circle · row to open</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {loading && visibleToday.length === 0 && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}
              {!loading && visibleToday.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>
                  <Icon name="trophy" color="var(--sand)" size={32} />
                  <p style={{ margin: "8px 0 0", fontWeight: 700 }}>
                    {todayView === "mine"
                      ? "Nothing of yours left today."
                      : todayView === "adults"
                        ? "No adult chores today. Kids ones live in Kids Mode."
                        : "Nothing left for today. The home is sorted."}
                  </p>
                </div>
              )}
              {visibleToday.map((c) => (
                <ChoreRow key={c.id} chore={c} onToggle={onToggle} onOpen={onOpen} onToggleImportant={onToggleImportant} dense />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card">
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Coming up</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcoming.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing scheduled yet.</p>}
                {upcoming.slice(0, 4).map((c) => (
                  <ChoreRow key={c.id} chore={c} onToggle={onToggle} onOpen={onOpen} onToggleImportant={onToggleImportant} dense />
                ))}
              </div>
            </div>
            <div className="card" style={{ background: "var(--bg-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Repeats</h2>
                <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>Auto</span>
              </div>
              <RecurringList rows={recurringNext.slice(0, 4)} dense />
            </div>
          </div>
        </div>

        <WhatsOnCard
          events={p.events}
          chores={p.chores}
          onEventClick={p.onEventClick}
          onChoreOpen={p.onOpen}
        />
      </div>
    </div>
  );
}

function MobileHome(p: HomeProps) {
  const { hello, dateLabel, stats, todayChores, completedToday, remainingToday, recurringNext, filter, setFilter, filtered, loading, onToggle, onOpen, onToggleImportant } = p;
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", fontSize: 11 }}>
          <Icon name={hello.emoji} color="var(--sand)" size={14} /> {dateLabel}
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 800 }}>{hello.greeting}.</h1>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
          {remainingToday > 0 ? `${remainingToday} chores left today` : "Nothing left — nice."}
        </p>
      </div>

      <WeatherCard compact />

      <div className="card" style={{ padding: 18, background: "linear-gradient(135deg, var(--terracotta-soft), var(--surface))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--terracotta-deep)" }}>Today</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--terracotta-deep)" }}>
            <Icon name="fire" color="var(--terracotta)" size={14} /> {stats?.streak ?? 0}-day streak
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Ring value={completedToday} max={todayChores.length || 1} size={72} stroke={8} color="var(--terracotta-deep)" label={`${completedToday}/${todayChores.length}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
              {remainingToday > 0 ? `${remainingToday} to go` : "Done for today!"}
            </div>
            <div style={{ fontSize: 12, color: "var(--terracotta-deep)", marginTop: 2 }}>
              Score · {stats?.score ?? 0} / 100
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto" }} className="no-scrollbar">
        {(["today", "upcoming", "mine", "all"] as const).map((t) => {
          const sel = filter === t;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              type="button"
              style={{
                padding: "8px 16px",
                borderRadius: 99,
                background: sel ? "var(--ink)" : "rgba(0,0,0,0.04)",
                color: sel ? "var(--surface)" : "var(--ink-2)",
                fontWeight: 800,
                fontSize: 13,
                whiteSpace: "nowrap"
              }}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && filtered.length === 0 && (
          <>
            <SkeletonRow dense />
            <SkeletonRow dense />
          </>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>
            <Icon name="trophy" color="var(--sand)" size={28} />
            <p style={{ margin: "6px 0 0", fontWeight: 700 }}>Nothing here. Nice.</p>
          </div>
        )}
        {filtered.map((c) => (
          <ChoreRow key={c.id} chore={c} onToggle={onToggle} onOpen={onOpen} onToggleImportant={onToggleImportant} dense />
        ))}
      </div>

      <div className="card" style={{ padding: 16, background: "var(--bg-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Repeating</h3>
          <span className="muted" style={{ fontSize: 12 }}>Auto-scheduled</span>
        </div>
        <RecurringList rows={recurringNext} dense />
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
                : "—"} · next {humanDue(r.dueDate ? new Date(r.dueDate) : null) || "soon"}
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
  | "calendar"
  | "account"
  | "integrations";

const SETTINGS_SECTIONS: Array<{ key: SettingsSectionKey; label: string; icon: string; desc: string }> = [
  { key: "family", label: "Household", icon: "users", desc: "Members, kids, roles" },
  { key: "categories", label: "Categories", icon: "layers", desc: "Tags + colors" },
  { key: "notifications", label: "Notifications", icon: "clock", desc: "Push + daily digest" },
  { key: "weather", label: "Weather", icon: "sun", desc: "Location + forecast" },
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
