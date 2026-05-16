import { z } from "zod";
import { prisma } from "./prisma";
import { nextOccurrence } from "./recurrence";
import type { Chore, RecurrenceUnit } from "@prisma/client";

export const choreInputSchema = z.object({
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().nullable(),
  icon: z.string().min(1).max(40).default("broom"),
  category: z.string().min(1).max(40).default("cleaning"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assigneeSlug: z.enum(["davide", "luize", "both", "unassigned"]).default("unassigned"),
  dueDate: z.string().datetime().nullable().optional(),
  isRecurring: z.boolean().default(false),
  recurInterval: z.number().int().min(1).max(365).nullable().optional(),
  recurUnit: z.enum(["day", "week", "month"]).nullable().optional(),
  recurDaysOfWeek: z.string().max(60).nullable().optional(),
  recurDayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  important: z.boolean().optional()
});

export type ChoreInput = z.infer<typeof choreInputSchema>;

async function resolveAssigneeId(slug?: string | null): Promise<string | null> {
  if (!slug) return null;
  const m = await prisma.familyMember.findUnique({ where: { slug } });
  return m?.id ?? null;
}

export async function createChore(input: ChoreInput): Promise<Chore> {
  const assigneeId = await resolveAssigneeId(input.assigneeSlug);
  return prisma.chore.create({
    data: {
      title: input.title.trim(),
      notes: input.notes ?? null,
      icon: input.icon,
      category: input.category,
      priority: input.priority,
      assigneeId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      isRecurring: input.isRecurring,
      recurInterval: input.isRecurring ? input.recurInterval ?? 1 : null,
      recurUnit: input.isRecurring ? input.recurUnit ?? "week" : null,
      recurDaysOfWeek: input.recurDaysOfWeek ?? null,
      recurDayOfMonth: input.recurDayOfMonth ?? null,
      important: input.important ?? false
    }
  });
}

export async function updateChore(id: string, input: Partial<ChoreInput>): Promise<Chore> {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.category !== undefined) data.category = input.category;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.assigneeSlug !== undefined) data.assigneeId = await resolveAssigneeId(input.assigneeSlug);
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
  if (input.recurInterval !== undefined) data.recurInterval = input.recurInterval;
  if (input.recurUnit !== undefined) data.recurUnit = input.recurUnit;
  if (input.recurDaysOfWeek !== undefined) data.recurDaysOfWeek = input.recurDaysOfWeek;
  if (input.recurDayOfMonth !== undefined) data.recurDayOfMonth = input.recurDayOfMonth;
  if (input.important !== undefined) data.important = input.important;
  return prisma.chore.update({ where: { id }, data });
}

export async function completeChore(id: string, memberSlug?: string): Promise<{ completed: Chore; next?: Chore | null }> {
  const c = await prisma.chore.findUnique({ where: { id } });
  if (!c) throw new Error("Chore not found");

  // Idempotent: already completed → no-op, no new completion row, no new recurring instance
  if (c.status === "completed") {
    return { completed: c, next: null };
  }

  const now = new Date();
  // Use the explicit memberSlug if provided, otherwise fall back to the chore's assignee.
  let memberId: string | null = null;
  if (memberSlug) {
    memberId = (await prisma.familyMember.findUnique({ where: { slug: memberSlug } }))?.id ?? null;
  } else if (c.assigneeId) {
    memberId = c.assigneeId;
  }

  await prisma.choreCompletion.create({
    data: {
      choreId: c.id,
      memberId,
      completedAt: now,
      occurrenceFor: c.dueDate
    }
  });

  const completed = await prisma.chore.update({
    where: { id: c.id },
    data: { status: "completed", completedAt: now }
  });

  let nextChore: Chore | null = null;
  if (c.isRecurring && c.recurInterval && c.recurUnit) {
    const baseDate = c.dueDate ?? now;
    const next = nextOccurrence(baseDate, {
      interval: c.recurInterval,
      unit: c.recurUnit as RecurrenceUnit,
      daysOfWeek: c.recurDaysOfWeek ? c.recurDaysOfWeek.split(",").map((s) => s.trim()) : undefined,
      dayOfMonth: c.recurDayOfMonth ?? undefined
    });
    nextChore = await prisma.chore.create({
      data: {
        title: c.title,
        notes: c.notes,
        icon: c.icon,
        category: c.category,
        priority: c.priority,
        assigneeId: c.assigneeId,
        dueDate: next,
        isRecurring: true,
        recurInterval: c.recurInterval,
        recurUnit: c.recurUnit,
        recurDaysOfWeek: c.recurDaysOfWeek,
        recurDayOfMonth: c.recurDayOfMonth
      }
    });
  }

  return { completed, next: nextChore };
}

export async function uncompleteChore(id: string): Promise<Chore> {
  // Remove the most recent completion row so the count stays honest when toggling.
  const latest = await prisma.choreCompletion.findFirst({
    where: { choreId: id },
    orderBy: { completedAt: "desc" }
  });
  if (latest) {
    await prisma.choreCompletion.delete({ where: { id: latest.id } });
  }
  return prisma.chore.update({
    where: { id },
    data: { status: "active", completedAt: null }
  });
}

export async function archiveChore(id: string): Promise<Chore> {
  return prisma.chore.update({ where: { id }, data: { status: "archived" } });
}

export async function listChores(opts?: { status?: "active" | "completed" | "archived" | "all" }) {
  const status = opts?.status ?? "active";
  return prisma.chore.findMany({
    where: status === "all" ? {} : { status },
    include: { assignee: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });
}
