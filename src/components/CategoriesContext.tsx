"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CATEGORIES as FALLBACK, type Category } from "../lib/catalog";

const Ctx = createContext<Category[]>(FALLBACK);

export function CategoriesProvider({ value, children }: { value: Category[] | null; children: ReactNode }) {
  return <Ctx.Provider value={value && value.length > 0 ? value : FALLBACK}>{children}</Ctx.Provider>;
}

export function useCategories(): Category[] {
  return useContext(Ctx);
}

export function useCategory(slug: string): Category | undefined {
  const list = useCategories();
  return list.find((c) => c.id === slug);
}
