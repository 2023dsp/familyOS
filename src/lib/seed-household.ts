import { prisma } from "./prisma";

const DEFAULT_CATEGORIES = [
  { slug: "cleaning", label: "Cleaning", icon: "broom", color: "#C97B5B", colorSoft: "#E8C2AC", sortOrder: 10 },
  { slug: "kitchen", label: "Kitchen", icon: "dishes", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 20 },
  { slug: "errands", label: "Errands", icon: "cart", color: "#D9B36C", colorSoft: "#F0DEB3", sortOrder: 30 },
  { slug: "home", label: "Home & Care", icon: "sofa", color: "#6F8AA8", colorSoft: "#C5D2DF", sortOrder: 40 },
  { slug: "garden", label: "Garden", icon: "plant", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 50 },
  { slug: "vehicle", label: "Vehicle", icon: "car", color: "#5C4F3F", colorSoft: "#DFD0B4", sortOrder: 60 },
  { slug: "bills", label: "Admin & Bills", icon: "card", color: "#D89AA0", colorSoft: "#F1D6D9", sortOrder: 70 },
  { slug: "appointments", label: "Appointments", icon: "book", color: "#A85F40", colorSoft: "#E8C2AC", sortOrder: 80 }
];

const DEFAULT_TEMPLATES = [
  { title: "Take out trash", icon: "trash", category: "cleaning", priority: "medium" as const, defaultRecurInterval: 1, defaultRecurUnit: "week" as const },
  { title: "Empty dishwasher", icon: "dishes", category: "kitchen", priority: "medium" as const, defaultRecurInterval: 1, defaultRecurUnit: "day" as const },
  { title: "Grocery shopping", icon: "cart", category: "errands", priority: "medium" as const, defaultRecurInterval: 1, defaultRecurUnit: "week" as const },
  { title: "Water plants", icon: "drop", category: "garden", priority: "low" as const, defaultRecurInterval: 2, defaultRecurUnit: "day" as const },
  { title: "Pay bill", icon: "card", category: "bills", priority: "high" as const, defaultRecurInterval: 1, defaultRecurUnit: "month" as const },
  { title: "Book appointment", icon: "book", category: "appointments", priority: "medium" as const },
  { title: "Clean bathroom", icon: "broom", category: "cleaning", priority: "medium" as const, defaultRecurInterval: 1, defaultRecurUnit: "week" as const },
  { title: "Laundry", icon: "drop", category: "cleaning", priority: "medium" as const, defaultRecurInterval: 1, defaultRecurUnit: "week" as const }
];

const PALETTE = ["#2F6FDB", "#C2477A", "#E0A31A", "#3E7C5A", "#7A4FD1", "#D9622B", "#2B9A8F", "#5A6B7A"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "owner";
}

type Db = Pick<typeof prisma, "familyMember">;

/**
 * Make sure a household user also exists as an assignable FamilyMember
 * (the "who" picker lists FamilyMembers, not accounts). Idempotent.
 */
export async function ensurePersonMember(db: Db, householdId: string, name: string): Promise<void> {
  const slug = slugify(name);
  const persons = await db.familyMember.count({ where: { householdId, isPerson: true } });
  await db.familyMember.upsert({
    where: { householdId_slug: { householdId, slug } },
    update: {},
    create: {
      slug,
      name,
      initials: name.charAt(0).toUpperCase() || "?",
      color: PALETTE[persons % PALETTE.length]!,
      isPerson: true,
      isChild: false,
      sortOrder: persons,
      householdId
    }
  });
}

/**
 * Seed a brand-new household with sensible defaults so its dashboard isn't empty.
 */
export async function seedNewHousehold(householdId: string, ownerName: string | null): Promise<void> {
  // Categories
  for (const c of DEFAULT_CATEGORIES) {
    try {
      await prisma.category.create({
        data: { ...c, isCustom: false, householdId }
      });
    } catch {
      /* already exists, ignore */
    }
  }

  // Family members
  const ownerSlug = slugify(ownerName ?? "you");
  const initial = (ownerName ?? "Y").charAt(0).toUpperCase();
  await prisma.familyMember.upsert({
    where: { householdId_slug: { householdId, slug: ownerSlug } },
    update: {},
    create: {
      slug: ownerSlug,
      name: ownerName ?? "You",
      initials: initial,
      color: PALETTE[0]!,
      isPerson: true,
      isChild: false,
      sortOrder: 0,
      householdId
    }
  });
  await prisma.familyMember.upsert({
    where: { householdId_slug: { householdId, slug: "unassigned" } },
    update: {},
    create: {
      slug: "unassigned",
      name: "Anyone",
      initials: "?",
      color: "#8A7A65",
      isPerson: false,
      isChild: false,
      sortOrder: 101,
      householdId
    }
  });

  // Templates
  for (const t of DEFAULT_TEMPLATES) {
    try {
      await prisma.choreTemplate.create({ data: { ...t, householdId } });
    } catch {
      /* ignore */
    }
  }
}
