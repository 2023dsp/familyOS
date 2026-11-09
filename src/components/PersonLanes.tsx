"use client";

import { useMemo } from "react";
import { Icon } from "./Icon";
import type { ChoreRowData } from "./ChoreRow";
import { useFamilyMembers, type Member } from "./FamilyMembersContext";
import { isSameDay, startOfDay } from "../lib/date";

/** Seven-day strip starting today; shows how many open chores each day has. */
export function WeekStrip({
  chores,
  selected,
  onSelect
}: {
  chores: ChoreRowData[];
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const t0 = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i));
  }, []);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }} role="tablist" aria-label="Day">
      {days.map((d, i) => {
        const sel = isSameDay(d, selected);
        const open = chores.filter((c) => !c.done && c.dueDate && isSameDay(new Date(c.dueDate), d)).length;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onSelect(d)}
            style={{
              padding: "7px 0 6px",
              borderRadius: 12,
              background: sel ? "var(--ink)" : "transparent",
              color: sel ? "var(--bg)" : "var(--ink-3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              fontWeight: 700,
              fontSize: 11
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: 0.04 }}>
              {i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: sel ? "var(--bg)" : "var(--ink)" }}>{d.getDate()}</span>
            <span
              aria-label={`${open} open`}
              style={{
                width: 5,
                height: 5,
                borderRadius: 99,
                background: open > 0 ? (sel ? "var(--bg)" : "var(--terracotta)") : "transparent"
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

type Lane = { key: string; label: string; initials: string; color: string; isChild: boolean; chores: ChoreRowData[] };

/**
 * Chores for one day, split into one lane per person. A chore with several
 * assignees shows in each of their lanes; unassigned ones go in "Anyone".
 * When `day` is today, overdue open chores are pulled in and marked late.
 */
export function PersonLanes({
  chores,
  day,
  columns,
  onToggle,
  onOpen
}: {
  chores: ChoreRowData[];
  day: Date;
  columns: boolean;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (c: ChoreRowData) => void;
}) {
  const members = useFamilyMembers();
  const isToday = isSameDay(day, new Date());

  const { lanes, late } = useMemo(() => {
    const dayStart = startOfDay(day);
    const late = new Set<string>();
    const seenLate = new Set<string>();
    const forDay = chores.filter((c) => {
      if (!c.dueDate) return false;
      const due = new Date(c.dueDate);
      if (isSameDay(due, day)) return true;
      if (isToday && !c.done && due < dayStart) {
        // One entry per overdue series, not one per missed instance.
        const key = c.title.trim().toLowerCase();
        if (seenLate.has(key)) return false;
        seenLate.add(key);
        late.add(c.id);
        return true;
      }
      return false;
    });
    forDay.sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

    const persons = members.filter((m) => m.isPerson);
    const personSlugs = new Set(persons.map((m) => m.slug));
    const slugsOf = (c: ChoreRowData) => (c.assigneeSlugs && c.assigneeSlugs.length > 0 ? c.assigneeSlugs : [c.assigneeSlug]);

    const lanes: Lane[] = persons.map((m: Member) => ({
      key: m.slug,
      label: m.name,
      initials: m.initials || m.name.charAt(0).toUpperCase(),
      color: m.color,
      isChild: m.isChild,
      chores: forDay.filter((c) => slugsOf(c).includes(m.slug))
    }));
    const anyone = forDay.filter((c) => !slugsOf(c).some((s) => personSlugs.has(s)));
    if (anyone.length > 0) {
      lanes.push({ key: "anyone", label: "Anyone", initials: "?", color: "var(--ink-4)", isChild: false, chores: anyone });
    }
    return { lanes, late };
  }, [chores, members, day, isToday]);

  if (lanes.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns ? `repeat(auto-fit, minmax(260px, 1fr))` : "1fr",
        gap: 12,
        alignItems: "start"
      }}
    >
      {lanes.map((lane) => {
        const done = lane.chores.filter((c) => c.done).length;
        const total = lane.chores.length;
        return (
          <section
            key={lane.key}
            aria-label={lane.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 18,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
              minHeight: columns ? 180 : undefined
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: lane.key === "anyone" ? "transparent" : lane.color,
                  border: lane.key === "anyone" ? "1.5px dashed var(--line-2)" : "none",
                  color: lane.key === "anyone" ? "var(--ink-3)" : "white",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 13,
                  flexShrink: 0
                }}
              >
                {lane.initials}
              </span>
              <span style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lane.label}</span>
              {total > 0 ? (
                <>
                  <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden", minWidth: 30 }}>
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${Math.round((done / total) * 100)}%`,
                        background: lane.key === "anyone" ? "var(--ink-3)" : lane.color,
                        borderRadius: 3,
                        transition: "width 0.3s ease"
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                    {done}/{total}
                  </span>
                </>
              ) : (
                <span style={{ flex: 1 }} />
              )}
            </header>
            {total === 0 && (
              <p style={{ margin: "2px 0 0 40px", fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>
                {lane.isChild ? "No routine set" : "Nothing planned"}
              </p>
            )}
            {lane.chores.map((c) => (
              <LaneItem key={c.id} chore={c} late={late.has(c.id)} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function LaneItem({
  chore,
  late,
  onToggle,
  onOpen
}: {
  chore: ChoreRowData;
  late: boolean;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (c: ChoreRowData) => void;
}) {
  const due = chore.dueDate ? new Date(chore.dueDate) : null;
  const hasTime = !!due && (due.getHours() !== 0 || due.getMinutes() !== 0);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chore)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(chore);
        }
      }}
      className={chore.done ? "chore-done" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px 6px 0", borderRadius: 10, cursor: "pointer", minWidth: 0 }}
    >
      <button
        type="button"
        aria-label={chore.done ? `Mark ${chore.title} not done` : `Mark ${chore.title} done`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(chore.id, !chore.done);
        }}
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          flexShrink: 0
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 99,
            border: `2px solid ${chore.done ? "var(--olive)" : "var(--ink-4)"}`,
            background: chore.done ? "var(--olive)" : "transparent",
            display: "grid",
            placeItems: "center",
            transition: "all 0.15s ease"
          }}
        >
          {chore.done && <Icon name="check" color="white" size={12} />}
        </span>
      </button>
      <span className="chore-title" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {chore.title}
      </span>
      {chore.important && !chore.done && <Icon name="star" color="var(--sand)" size={14} />}
      {late && <Tag bg="var(--rose-soft)" fg="var(--rose)">late</Tag>}
      {chore.isPurchase && <Tag bg="var(--sand-soft)" fg="var(--ink-2)">purchase</Tag>}
      {hasTime && !late && (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
          {due!.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function Tag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: bg, color: fg, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.04 }}>
      {children}
    </span>
  );
}
