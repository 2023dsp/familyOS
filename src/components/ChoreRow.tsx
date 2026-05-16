"use client";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { CATEGORIES, PRIORITIES, type AssigneeSlug, type PriorityKey } from "../lib/catalog";
import { humanDue } from "../lib/date";
import { formatRecurrence } from "../lib/recurrence";
import type { RecurrenceUnit } from "@prisma/client";

export type ChoreRowData = {
  id: string;
  title: string;
  icon: string;
  category: string;
  priority: PriorityKey;
  assigneeSlug: AssigneeSlug;
  dueDate: string | null;
  isRecurring: boolean;
  recurInterval: number | null;
  recurUnit: RecurrenceUnit | null;
  recurDaysOfWeek: string | null;
  done: boolean;
  important: boolean;
};

export function PriorityDots({ p }: { p: PriorityKey }) {
  const pr = PRIORITIES[p];
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: i < pr.dots ? pr.color : "rgba(0,0,0,0.1)"
          }}
        />
      ))}
    </span>
  );
}

export function CheckButton({ done, onClick, size = "md" }: { done: boolean; onClick: () => void; size?: "md" | "lg" }) {
  return (
    <button
      className={`check ${done ? "done" : ""} ${size === "lg" ? "large" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      type="button"
    >
      {done && <Icon name="check" color="white" size={size === "lg" ? 22 : 16} />}
    </button>
  );
}

export function ChoreRow({
  chore,
  onToggle,
  onOpen,
  dense = false
}: {
  chore: ChoreRowData;
  onToggle: (id: string, done: boolean) => void;
  onOpen?: (c: ChoreRowData) => void;
  dense?: boolean;
}) {
  const cat = CATEGORIES.find((c) => c.id === chore.category);
  const due = humanDue(chore.dueDate ? new Date(chore.dueDate) : null);
  const recurLabel =
    chore.isRecurring && chore.recurInterval && chore.recurUnit
      ? formatRecurrence({
          interval: chore.recurInterval,
          unit: chore.recurUnit,
          daysOfWeek: chore.recurDaysOfWeek ? chore.recurDaysOfWeek.split(",") : undefined
        })
      : "";

  return (
    <div
      onClick={() => onOpen?.(chore)}
      className={chore.done ? "chore-done" : ""}
      style={{
        display: "flex",
        alignItems: "center",
        gap: dense ? 12 : 16,
        padding: dense ? "12px 14px" : "18px 18px",
        background: "var(--surface)",
        borderRadius: 24,
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        transition: "transform 0.08s ease, background 0.15s"
      }}
    >
      <CheckButton done={chore.done} onClick={() => onToggle(chore.id, !chore.done)} size={dense ? "md" : "lg"} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: dense ? 32 : 38,
              height: dense ? 32 : 38,
              borderRadius: 10,
              background: cat?.soft ?? "var(--surface-2)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0
            }}
          >
            <Icon name={chore.icon} color={cat?.color ?? "var(--terracotta)"} size={dense ? 18 : 22} />
          </span>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              className="chore-title"
              style={{
                fontWeight: 700,
                fontSize: dense ? 15 : 17,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {chore.title}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {recurLabel && (
                <span style={{ display: "inline-flex", gap: 4, alignItems: "center", color: "var(--ink-3)", fontSize: 12, fontWeight: 600 }}>
                  <Icon name="refresh" color="var(--ink-3)" size={12} />
                  {recurLabel}
                </span>
              )}
              {due && (
                <span style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 600 }}>
                  {recurLabel ? "·" : ""} {due}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <Avatar who={chore.assigneeSlug} size={dense ? 26 : 32} />
        <PriorityDots p={chore.priority} />
      </div>
    </div>
  );
}
