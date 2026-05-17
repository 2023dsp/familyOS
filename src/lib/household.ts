import { prisma } from "./prisma";

const DEFAULT_SETTING_KEY = "default_household_id";

/**
 * Single-source-of-truth for the legacy single-household flow. Until full
 * multi-tenant UI ships, every request that doesn't carry a v2 user/household
 * session falls back to this household. Created lazily on first call.
 */
export async function getOrCreateDefaultHousehold(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { key: DEFAULT_SETTING_KEY } });
  if (setting?.value) {
    const exists = await prisma.household.findUnique({ where: { id: setting.value } });
    if (exists) return exists.id;
  }

  // Pick an existing household if any (e.g. created via /api/auth/v2/register)
  const any = await prisma.household.findFirst({ orderBy: { createdAt: "asc" } });
  if (any) {
    await prisma.appSetting.upsert({
      where: { key: DEFAULT_SETTING_KEY },
      update: { value: any.id },
      create: { key: DEFAULT_SETTING_KEY, value: any.id }
    });
    return any.id;
  }

  // Otherwise create a placeholder owner + household so foreign keys never null
  let placeholderOwner = await prisma.user.findUnique({ where: { email: "kiosk@familyos.local" } });
  if (!placeholderOwner) {
    placeholderOwner = await prisma.user.create({
      data: {
        email: "kiosk@familyos.local",
        // Bcrypt hash of a long random string nobody will ever guess.
        // The kiosk login path never uses it — it's just here to satisfy the schema.
        passwordHash: "$2a$12$RVxQ4lA0G93z3HtBJlfLeOlQ1cZJULJDx6tn8X4qZlYqzZqv1nUUW",
        name: "Kiosk"
      }
    });
  }
  const household = await prisma.household.create({
    data: { name: "Our home", ownerId: placeholderOwner.id }
  });
  await prisma.householdMember.upsert({
    where: { userId_householdId: { userId: placeholderOwner.id, householdId: household.id } },
    update: {},
    create: { userId: placeholderOwner.id, householdId: household.id, role: "owner" }
  });
  await prisma.appSetting.upsert({
    where: { key: DEFAULT_SETTING_KEY },
    update: { value: household.id },
    create: { key: DEFAULT_SETTING_KEY, value: household.id }
  });
  return household.id;
}

/**
 * Lightweight resolver used by API routes today. Reads the cookie session and
 * returns the active household id. v2-aware once the session payload starts
 * carrying householdId — for now everyone shares the default household.
 */
export async function getActiveHouseholdId(): Promise<string> {
  return getOrCreateDefaultHousehold();
}

/**
 * Backfill: stamp any null householdId rows with the default household. Cheap
 * and idempotent — safe to call on every boot from the seed script.
 */
export async function backfillTenantColumns(): Promise<void> {
  const householdId = await getOrCreateDefaultHousehold();
  const r1 = await prisma.chore.updateMany({ where: { householdId: null }, data: { householdId } });
  const r2 = await prisma.choreTemplate.updateMany({ where: { householdId: null }, data: { householdId } });
  const r3 = await prisma.calendarEvent.updateMany({ where: { householdId: null }, data: { householdId } });
  const r4 = await prisma.category.updateMany({ where: { householdId: null }, data: { householdId } });
  const r5 = await prisma.familyMember.updateMany({ where: { householdId: null }, data: { householdId } });
  const r6 = await prisma.pushSubscription.updateMany({ where: { householdId: null }, data: { householdId } });
  const total = r1.count + r2.count + r3.count + r4.count + r5.count + r6.count;
  if (total > 0) console.log(`Backfilled ${total} rows with householdId=${householdId}`);
}
