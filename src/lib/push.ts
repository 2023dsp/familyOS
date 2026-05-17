import webpush from "web-push";
import { prisma } from "./prisma";

function configured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configuredOnce = false;
function configureOnce() {
  if (configuredOnce || !configured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@familyos.local",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  configuredOnce = true;
}

export function getPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  label?: string;
  householdId?: string | null;
}): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
      label: input.label ?? null,
      lastSeenAt: new Date(),
      ...(input.householdId ? { householdId: input.householdId } : {})
    },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent ?? null,
      label: input.label ?? null,
      householdId: input.householdId ?? null
    }
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send a push to all subscriptions on a household. Must be scoped — sending to
 * every subscription in the DB would leak chore notifications across families.
 */
export async function sendToHousehold(
  householdId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number }> {
  if (!configured()) throw new Error("VAPID keys not set");
  if (!householdId) throw new Error("householdId required");
  configureOnce();
  const subs = await prisma.pushSubscription.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" }
  });
  let sent = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (e) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          pruned++;
        }
      }
    })
  );
  return { sent, pruned };
}
