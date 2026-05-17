import { z } from "zod";
import { prisma } from "./prisma";
import { getActiveHouseholdId } from "./household";

export const PERSONAS = ["davide", "luize", "family", "other"] as const;
export type Persona = (typeof PERSONAS)[number];

export const PERSONA_META: Record<Persona, { label: string; color: string; soft: string }> = {
  davide: { label: "Davide", color: "#6F8AA8", soft: "#D6E0EB" },
  luize: { label: "Luize", color: "#D89AA0", soft: "#F4DCDF" },
  family: { label: "Family", color: "#C97B5B", soft: "#E8C2AC" },
  other: { label: "Other", color: "#5C4F3F", soft: "#DFD0B4" }
};

export const eventInputSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().default(false),
  persona: z.enum(PERSONAS).nullable().optional(),
  calendar: z.string().max(60).nullable().optional()
});

export type EventInput = z.infer<typeof eventInputSchema>;

export function detectPersona(title: string): Persona {
  const t = title.toLowerCase();
  if (/\bdavide\b/.test(t)) return "davide";
  if (/\bluize\b/.test(t)) return "luize";
  if (/\bfamiglia\b|\bfamily\b|\bcasa\b|\bhome\b/.test(t)) return "family";
  return "other";
}

export function eventColor(persona?: string | null, fallback?: string | null): { color: string; soft: string } {
  if (persona && (PERSONAS as readonly string[]).includes(persona)) {
    return PERSONA_META[persona as Persona];
  }
  if (fallback) return { color: fallback, soft: fallback };
  return PERSONA_META.other;
}

export async function createEvent(input: EventInput) {
  const persona = input.persona ?? detectPersona(input.title);
  const color = PERSONA_META[persona].color;
  const householdId = await getActiveHouseholdId();
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
    if (input.persona) data.color = PERSONA_META[input.persona].color;
  }
  if (input.calendar !== undefined) data.calendar = input.calendar;
  return prisma.calendarEvent.update({ where: { id }, data });
}

export async function deleteEvent(id: string) {
  return prisma.calendarEvent.delete({ where: { id } });
}
