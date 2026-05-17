import { z } from "zod";
import { prisma } from "./prisma";
import { getActiveHouseholdId } from "./household";

/**
 * Persona is now just a string: usually a FamilyMember slug, or one of
 * the special tokens "family" / "other" / null. Colors come from the
 * household's actual members at render time.
 */
export type Persona = string;

export const FAMILY_FALLBACK_COLOR = "#C97B5B";
export const OTHER_FALLBACK_COLOR = "#5C4F3F";

export const eventInputSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().default(false),
  persona: z.string().max(40).nullable().optional(),
  calendar: z.string().max(60).nullable().optional()
});

export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * Detect a household member slug from a free-form title. Optionally takes a
 * list of {slug, name} pairs (from FamilyMember table) so detection matches
 * the actual household, not hardcoded names.
 */
export function detectPersona(title: string, candidates: Array<{ slug: string; name: string }> = []): Persona {
  const t = title.toLowerCase();
  for (const c of candidates) {
    const needle = c.name.toLowerCase();
    if (needle && new RegExp(`\\b${needle.replace(/[^a-z0-9]/g, ".")}\\b`).test(t)) {
      return c.slug;
    }
  }
  if (/\bfamiglia\b|\bfamily\b|\bcasa\b|\bhome\b/.test(t)) return "family";
  return "other";
}

export async function createEvent(input: EventInput) {
  const householdId = await getActiveHouseholdId();
  const householdMembers = await prisma.familyMember.findMany({
    where: { householdId, isPerson: true },
    select: { slug: true, name: true, color: true }
  });
  const persona = input.persona ?? detectPersona(input.title, householdMembers);
  const matched = householdMembers.find((m) => m.slug === persona);
  const color = matched?.color ?? (persona === "family" ? FAMILY_FALLBACK_COLOR : OTHER_FALLBACK_COLOR);
  return prisma.calendarEvent.create({
    data: {
      title: input.title.trim(),
      description: input.description ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      allDay: input.allDay,
      calendar: input.calendar ?? null,
      color,
      persona,
      source: "local",
      householdId
    }
  });
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description;
  if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
  if (input.endsAt !== undefined) data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.allDay !== undefined) data.allDay = input.allDay;
  if (input.persona !== undefined) {
    data.persona = input.persona;
    if (input.persona) {
      const ev = await prisma.calendarEvent.findUnique({ where: { id } });
      const hid = ev?.householdId;
      if (hid) {
        const m = await prisma.familyMember.findFirst({
          where: { householdId: hid, slug: input.persona },
          select: { color: true }
        });
        data.color = m?.color ?? (input.persona === "family" ? FAMILY_FALLBACK_COLOR : OTHER_FALLBACK_COLOR);
      }
    }
  }
  if (input.calendar !== undefined) data.calendar = input.calendar;
  return prisma.calendarEvent.update({ where: { id }, data });
}

export async function deleteEvent(id: string) {
  return prisma.calendarEvent.delete({ where: { id } });
}
