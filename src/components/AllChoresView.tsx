"use client";

import { ChoreRow, type ChoreRowData } from "./ChoreRow";
import { Icon } from "./Icon";

type Section = { key: string; label: string; items: ChoreRowData[] };

function bucket(chores: ChoreRowData[]): Section[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const overdue: ChoreRowData[] = [];
  const today: ChoreRowData[] = [];
  const week: ChoreRowData[] = [];
  const later: ChoreRowData[] = [];
  const nodate: ChoreRowData[] = [];
  const completed: ChoreRowData[] = [];
  const archived: ChoreRowData[] = [];

  const sevenDays = new Date(now.getTime() + 7 * 86400_000);

  for (const c of chores) {
    if (c.done) {
      completed.push(c);
      continue;
    }
    if (!c.dueDate) {
      nodate.push(c);
      continue;
    }
    const due = new Date(c.dueDate);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay < now) overdue.push(c);
    else if (dueDay.getTime() === now.getTime()) today.push(c);
    else if (dueDay <= sevenDays) week.push(c);
    else later.push(c);
  }

  const byDate = (a: ChoreRowData, b: ChoreRowData) =>
    (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0);
  overdue.sort(byDate);
  today.sort(byDate);
  week.sort(byDate);
  later.sort(byDate);

  return [
    { key: "overdue", label: "Overdue", items: overdue },
    { key: "today", label: "Today", items: today },
    { key: "week", label: "Next 7 days", items: week },
    { key: "later", label: "Later", items: later },
    { key: "nodate", label: "No due date", items: nodate },
    { key: "completed", label: "Recently completed", items: completed.slice(0, 30) },
    { key: "archived", label: "Archived", items: archived }
  ];
}

export function AllChoresView({
  chores,
  isWide,
  onToggle,
  onOpen,
  onToggleImportant
}: {
  chores: ChoreRowData[];
  isWide: boolean;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (c: ChoreRowData) => void;
  onToggleImportant: (id: string, next: boolean) => void;
}) {
  const sections = bucket(chores).filter((s) => s.items.length > 0);
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.08 }}>All chores</span>
        <h1 style={{ margin: "4px 0", fontSize: isWide ? 32 : 24, fontWeight: 800 }}>Everything, by due date</h1>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Tap the green circle on a completed chore to restore it. Tap the row to open the detail view.
        </p>
      </div>

      {sections.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <Icon name="trophy" color="var(--sand)" size={36} />
          <p style={{ margin: "8px 0 0", fontWeight: 700 }}>No chores yet.</p>
        </div>
      )}

      {sections.map((s) => (
        <section key={s.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.08, color: s.key === "overdue" ? "var(--danger)" : "var(--ink-3)" }}>
            {s.label} <span className="muted" style={{ fontWeight: 600 }}>· {s.items.length}</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.items.map((c) => (
              <ChoreRow key={c.id} chore={c} onToggle={onToggle} onOpen={onOpen} onToggleImportant={onToggleImportant} dense={!isWide} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
