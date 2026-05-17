import { prisma } from "./prisma";
import { getActiveHouseholdId } from "./household";

export const DEFAULT_CATEGORIES: Array<{
  slug: string;
  label: string;
  icon: string;
  color: string;
  colorSoft: string;
  sortOrder: number;
}> = [
  { slug: "cleaning", label: "Cleaning", icon: "broom", color: "#C97B5B", colorSoft: "#E8C2AC", sortOrder: 10 },
  { slug: "kitchen", label: "Kitchen", icon: "dishes", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 20 },
  { slug: "errands", label: "Errands", icon: "cart", color: "#D9B36C", colorSoft: "#F0DEB3", sortOrder: 30 },
  { slug: "home", label: "Home & Care", icon: "sofa", color: "#6F8AA8", colorSoft: "#C5D2DF", sortOrder: 40 },
  { slug: "garden", label: "Garden", icon: "plant", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 50 },
  { slug: "vehicle", label: "Vehicle", icon: "car", color: "#5C4F3F", colorSoft: "#DFD0B4", sortOrder: 60 },
  { slug: "bills", label: "Admin & Bills", icon: "card", color: "#D89AA0", colorSoft: "#F1D6D9", sortOrder: 70 },
  { slug: "appointments", label: "Appointments", icon: "book", color: "#A85F40", colorSoft: "#E8C2AC", sortOrder: 80 }
];

export async function ensureDefaultCategoriesSeeded() {
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, isCustom: false }
    });
  }
}

export async function listCategories() {
  const householdId = await getActiveHouseholdId();
  return prisma.category.findMany({
    where: { householdId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
  });
}
