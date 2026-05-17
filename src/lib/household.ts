import { prisma } from "./prisma";

/**
 * Resolves the active household from the v2 session cookie (email+password
 * login). Throws if the caller is not authenticated — there is no fallback
 * since the kiosk shared-password path was removed.
 */
export async function getActiveHouseholdId(): Promise<string> {
  const { getSession } = await import("./auth");
  const session = await getSession();
  if (!session?.hid) {
    throw new Error("Unauthorized");
  }
  const exists = await prisma.household.findUnique({ where: { id: session.hid } });
  if (!exists) throw new Error("Household not found");
  return exists.id;
}
