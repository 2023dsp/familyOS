// Plain-CJS seed so we don't need tsx/esbuild at runtime.
// Idempotent: NEVER overwrites user-edited rows.
// - Categories / FamilyMembers / Templates are only inserted if missing.
// - We do not touch existing colors, sortOrder, labels, etc.
// - No kiosk household / placeholder user creation (kiosk path is gone).
// New households get their initial members + categories from
// src/lib/seed-household.ts at register time, not here.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { slug: "cleaning", label: "Cleaning", icon: "broom", color: "#C97B5B", colorSoft: "#E8C2AC", sortOrder: 10 },
  { slug: "kitchen", label: "Kitchen", icon: "dishes", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 20 },
  { slug: "errands", label: "Errands", icon: "cart", color: "#D9B36C", colorSoft: "#F0DEB3", sortOrder: 30 },
  { slug: "home", label: "Home & Care", icon: "sofa", color: "#6F8AA8", colorSoft: "#C5D2DF", sortOrder: 40 },
  { slug: "garden", label: "Garden", icon: "plant", color: "#3F4B3B", colorSoft: "#B5C2A6", sortOrder: 50 },
  { slug: "vehicle", label: "Vehicle", icon: "car", color: "#5C4F3F", colorSoft: "#DFD0B4", sortOrder: 60 },
  { slug: "bills", label: "Admin & Bills", icon: "card", color: "#D89AA0", colorSoft: "#F1D6D9", sortOrder: 70 },
  { slug: "appointments", label: "Appointments", icon: "book", color: "#A85F40", colorSoft: "#E8C2AC", sortOrder: 80 },
  { slug: "kids", label: "Kids", icon: "star", color: "#E59A89", colorSoft: "#FBE2D9", sortOrder: 90 },
  { slug: "health", label: "Health", icon: "pill", color: "#7DA08A", colorSoft: "#DDE9E0", sortOrder: 100 }
];

const SYSTEM_MEMBERS = [
  { slug: "both", name: "Both", initials: "+", color: "#C97B5B", isPerson: false },
  { slug: "unassigned", name: "Anyone", initials: "?", color: "#8A7A65", isPerson: false }
];

async function ensureSystemRowsForHousehold(householdId) {
  // Categories: only create the ones missing.
  for (const c of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findUnique({
      where: { householdId_slug: { householdId, slug: c.slug } }
    });
    if (!existing) {
      await prisma.category.create({ data: { ...c, isCustom: false, householdId } });
    }
  }
  // System assignees (Both / Anyone). Same idempotent pattern, no color reset.
  for (const m of SYSTEM_MEMBERS) {
    const existing = await prisma.familyMember.findUnique({
      where: { householdId_slug: { householdId, slug: m.slug } }
    });
    if (!existing) {
      await prisma.familyMember.create({ data: { ...m, householdId } });
    }
  }
}

async function main() {
  const households = await prisma.household.findMany({ select: { id: true } });
  for (const h of households) {
    await ensureSystemRowsForHousehold(h.id);
  }
  console.log(`Seed complete. ${households.length} household(s) scanned.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
