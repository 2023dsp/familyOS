"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Member = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  color: string;
  isPerson: boolean;
  isChild: boolean;
};

const Ctx = createContext<Member[]>([]);

export function FamilyMembersProvider({ value, children }: { value: Member[]; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFamilyMembers(): Member[] {
  return useContext(Ctx);
}

export function useMemberBySlug(slug: string | null | undefined): Member | undefined {
  const list = useFamilyMembers();
  if (!slug) return undefined;
  return list.find((m) => m.slug === slug);
}

/**
 * Returns the list of members suitable for the "Who is this chore for?"
 * picker: persons first (sorted), then non-person rows (Anyone).
 */
export function useAssignableMembers(): Member[] {
  const list = useFamilyMembers();
  const persons = list.filter((m) => m.isPerson);
  const others = list.filter((m) => !m.isPerson);
  return [...persons, ...others];
}

export function useMembersForPersona(): Member[] {
  // Only real persons + add synthetic "family" / "other" rendered separately.
  return useFamilyMembers().filter((m) => m.isPerson);
}
