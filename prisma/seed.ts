import { PrismaClient, Priority, RecurrenceUnit } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const members = [
    { slug: "davide", name: "Davide", initials: "D", color: "--davide", isPerson: true },
    { slug: "luize", name: "Luize", initials: "L", color: "--luize", isPerson: true },
    { slug: "both", name: "Both", initials: "D+L", color: "--terracotta", isPerson: false },
    { slug: "unassigned", name: "Anyone", initials: "?", color: "--ink-3", isPerson: false }
  ];
  for (const m of members) {
    await prisma.familyMember.upsert({
      where: { slug: m.slug },
      update: m,
      create: m
    });
  }

  const templates: Array<{
    title: string;
    icon: string;
    category: string;
    priority: Priority;
    defaultRecurInterval?: number;
    defaultRecurUnit?: RecurrenceUnit;
    seasonal?: boolean;
  }> = [
    { title: "Clean the garden", icon: "plant", category: "garden", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "week" },
    { title: "Buy light bulbs", icon: "bulb", category: "errands", priority: "low" },
    { title: "Change car tires", icon: "car", category: "vehicle", priority: "high", defaultRecurInterval: 6, defaultRecurUnit: "month", seasonal: true },
    { title: "Clean the sofa", icon: "sofa", category: "home", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "month" },
    { title: "Take out trash", icon: "trash", category: "cleaning", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "week" },
    { title: "Water plants", icon: "drop", category: "garden", priority: "low", defaultRecurInterval: 2, defaultRecurUnit: "day" },
    { title: "Pay bill", icon: "card", category: "bills", priority: "high", defaultRecurInterval: 1, defaultRecurUnit: "month" },
    { title: "Book appointment", icon: "book", category: "appointments", priority: "medium" },
    { title: "Clean bathroom", icon: "broom", category: "cleaning", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "week" },
    { title: "Vacuum living room", icon: "broom", category: "cleaning", priority: "low", defaultRecurInterval: 1, defaultRecurUnit: "week" },
    { title: "Laundry", icon: "drop", category: "cleaning", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "week" },
    { title: "Grocery shopping", icon: "cart", category: "errands", priority: "medium", defaultRecurInterval: 1, defaultRecurUnit: "week" }
  ];

  for (const t of templates) {
    const existing = await prisma.choreTemplate.findFirst({ where: { title: t.title } });
    if (existing) {
      await prisma.choreTemplate.update({ where: { id: existing.id }, data: t });
    } else {
      await prisma.choreTemplate.create({ data: t });
    }
  }

  const choreCount = await prisma.chore.count();
  if (choreCount === 0) {
    const luize = await prisma.familyMember.findUnique({ where: { slug: "luize" } });
    const davide = await prisma.familyMember.findUnique({ where: { slug: "davide" } });
    const both = await prisma.familyMember.findUnique({ where: { slug: "both" } });

    const today = new Date();
    today.setHours(20, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 5);

    await prisma.chore.createMany({
      data: [
        { title: "Water the kitchen herbs", icon: "drop", category: "garden", priority: "low", assigneeId: luize?.id, dueDate: today, isRecurring: true, recurInterval: 2, recurUnit: "day" },
        { title: "Take the recycling out", icon: "trash", category: "cleaning", priority: "medium", assigneeId: davide?.id, dueDate: today, isRecurring: true, recurInterval: 1, recurUnit: "week", recurDaysOfWeek: "mon", notes: "Bins go out before 7:30" },
        { title: "Empty the dishwasher", icon: "dishes", category: "kitchen", priority: "medium", assigneeId: both?.id, dueDate: today, isRecurring: true, recurInterval: 1, recurUnit: "day" },
        { title: "Pay the electricity bill", icon: "card", category: "bills", priority: "high", assigneeId: davide?.id, dueDate: tomorrow, isRecurring: true, recurInterval: 1, recurUnit: "month", recurDayOfMonth: 28, notes: "Direct debit pending" },
        { title: "Clean the sofa", icon: "sofa", category: "home", priority: "medium", assigneeId: both?.id, dueDate: nextWeek, isRecurring: true, recurInterval: 1, recurUnit: "month" },
        { title: "Buy two warm-white light bulbs", icon: "bulb", category: "errands", priority: "low", assigneeId: luize?.id, dueDate: nextWeek, notes: "E27 / 6W / dimmable" },
        { title: "Vacuum the bedroom", icon: "broom", category: "cleaning", priority: "low", assigneeId: davide?.id, dueDate: today, isRecurring: true, recurInterval: 1, recurUnit: "week", recurDaysOfWeek: "tue" }
      ]
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
