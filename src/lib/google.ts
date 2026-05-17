import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "./prisma";
import { detectPersona, FAMILY_FALLBACK_COLOR, OTHER_FALLBACK_COLOR } from "./events";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// AppSetting keys are global by primary key, so we namespace household-scoped
// settings under "h_<householdId>_<key>". Multi-tenant safe.
function k(householdId: string, key: string): string {
  return `h_${householdId}_${key}`;
}
const REFRESH = "google_refresh_token";
const EMAIL = "google_account_email";
const CAL_ID = "google_calendar_id";
const SYNC_TOKEN = "google_sync_token";
const LAST_SYNC = "google_last_sync_at";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

export function getOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function buildAuthUrl(state: string): string {
  const oauth = getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true
  });
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}
async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
async function clearSetting(key: string): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

export async function isGoogleConnected(householdId: string): Promise<boolean> {
  return (await getSetting(k(householdId, REFRESH))) != null;
}

export async function getGoogleStatus(householdId: string): Promise<{
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
}> {
  const [refresh, email, calId, last] = await Promise.all([
    getSetting(k(householdId, REFRESH)),
    getSetting(k(householdId, EMAIL)),
    getSetting(k(householdId, CAL_ID)),
    getSetting(k(householdId, LAST_SYNC))
  ]);
  return { connected: refresh != null, email, calendarId: calId, lastSyncAt: last };
}

export async function persistTokensFromCode(householdId: string, code: string): Promise<void> {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token. Re-run the connect flow.");
  }
  oauth.setCredentials(tokens);

  const cal = google.calendar({ version: "v3", auth: oauth });
  let calendarId = "primary";
  let email: string | null = null;
  try {
    const me = await cal.calendarList.get({ calendarId: "primary" });
    if (me.data.id) calendarId = me.data.id;
    if (me.data.summary) email = me.data.summary;
  } catch {
    /* fall back */
  }

  await setSetting(k(householdId, REFRESH), tokens.refresh_token);
  await setSetting(k(householdId, CAL_ID), calendarId);
  if (email) await setSetting(k(householdId, EMAIL), email);
  await clearSetting(k(householdId, SYNC_TOKEN));
}

export async function disconnectGoogle(householdId: string): Promise<void> {
  await Promise.all([
    clearSetting(k(householdId, REFRESH)),
    clearSetting(k(householdId, EMAIL)),
    clearSetting(k(householdId, CAL_ID)),
    clearSetting(k(householdId, SYNC_TOKEN)),
    clearSetting(k(householdId, LAST_SYNC))
  ]);
  await prisma.chore.updateMany({
    where: { householdId },
    data: { googleEventId: null, googleSyncedAt: null }
  });
  await prisma.calendarEvent.deleteMany({ where: { householdId, source: "google" } });
}

async function getAuthedClient(
  householdId: string
): Promise<{ oauth: OAuth2Client; calendarId: string } | null> {
  const refresh = await getSetting(k(householdId, REFRESH));
  if (!refresh) return null;
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: refresh });
  const calendarId = (await getSetting(k(householdId, CAL_ID))) ?? "primary";
  return { oauth, calendarId };
}

export async function pushLocalEventToGoogle(householdId: string, eventId: string): Promise<void> {
  const ctx = await getAuthedClient(householdId);
  if (!ctx) return;
  const ev = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!ev || ev.householdId !== householdId) return;
  const cal = google.calendar({ version: "v3", auth: ctx.oauth });

  const startDate = ev.startsAt;
  const endDate = ev.endsAt ?? new Date(startDate.getTime() + 60 * 60 * 1000);
  const body: calendar_v3.Schema$Event = {
    summary: ev.title,
    description: ev.description ?? undefined,
    start: ev.allDay
      ? { date: startDate.toISOString().slice(0, 10) }
      : { dateTime: startDate.toISOString() },
    end: ev.allDay
      ? { date: endDate.toISOString().slice(0, 10) }
      : { dateTime: endDate.toISOString() },
    extendedProperties: { private: { familyosEventId: ev.id, familyosPersona: ev.persona ?? "" } }
  };

  if (ev.externalId) {
    try {
      await cal.events.patch({ calendarId: ctx.calendarId, eventId: ev.externalId, requestBody: body });
    } catch (e) {
      const err = e as { code?: number };
      if (err.code === 404) {
        await prisma.calendarEvent.update({ where: { id: ev.id }, data: { externalId: null } });
      }
    }
  } else {
    try {
      const res = await cal.events.insert({ calendarId: ctx.calendarId, requestBody: body });
      if (res.data.id) {
        await prisma.calendarEvent.update({
          where: { id: ev.id },
          data: { externalId: res.data.id, source: "google" }
        });
      }
    } catch {
      /* ignore */
    }
  }
}

export async function deleteGoogleEvent(householdId: string, externalId: string): Promise<void> {
  const ctx = await getAuthedClient(householdId);
  if (!ctx) return;
  const cal = google.calendar({ version: "v3", auth: ctx.oauth });
  try {
    await cal.events.delete({ calendarId: ctx.calendarId, eventId: externalId });
  } catch {
    /* ignore */
  }
}

/** Sync a single household. Throws "Google not connected" if no refresh token. */
export async function syncGoogleCalendar(
  householdId: string
): Promise<{ pulled: number; pushed: number }> {
  const ctx = await getAuthedClient(householdId);
  if (!ctx) throw new Error("Google not connected");
  const { oauth, calendarId } = ctx;
  const cal = google.calendar({ version: "v3", auth: oauth });

  const syncToken = await getSetting(k(householdId, SYNC_TOKEN));
  let pulled = 0;
  let pushed = 0;

  const householdMembers = await prisma.familyMember.findMany({
    where: { householdId, isPerson: true },
    select: { slug: true, name: true, color: true }
  });

  // --- PULL: Google events -> CalendarEvent table (scoped to this household)
  const baseList: calendar_v3.Params$Resource$Events$List = { calendarId, singleEvents: true };
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const res = await cal.events.list({
        ...baseList,
        ...(syncToken ? { syncToken } : { timeMin: new Date(Date.now() - 7 * 86400_000).toISOString() }),
        ...(pageToken ? { pageToken } : {})
      });
      const items = res.data.items ?? [];
      for (const ev of items) {
        if (!ev.id) continue;
        if (ev.status === "cancelled") {
          await prisma.calendarEvent.deleteMany({ where: { externalId: ev.id, householdId } });
          continue;
        }
        const startsAt = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
        const endsAt = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : null;
        if (!startsAt) continue;
        const title = ev.summary ?? "(no title)";
        const persona = detectPersona(title, householdMembers);
        const matched = householdMembers.find((m) => m.slug === persona);
        const color = matched?.color ?? (persona === "family" ? FAMILY_FALLBACK_COLOR : OTHER_FALLBACK_COLOR);
        await prisma.calendarEvent.upsert({
          where: { externalId: ev.id },
          create: {
            externalId: ev.id,
            title,
            description: ev.description ?? null,
            startsAt,
            endsAt,
            allDay: !ev.start?.dateTime,
            calendar: calendarId,
            color,
            persona,
            source: "google",
            householdId
          },
          update: {
            title,
            description: ev.description ?? null,
            startsAt,
            endsAt,
            allDay: !ev.start?.dateTime,
            color,
            persona,
            householdId
          }
        });
        pulled++;
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    } while (pageToken);
  } catch (e) {
    const err = e as { code?: number };
    if (err.code === 410) {
      await clearSetting(k(householdId, SYNC_TOKEN));
      throw new Error("Sync token expired — try sync again to do a full refresh.");
    }
    throw e;
  }

  if (nextSyncToken) await setSetting(k(householdId, SYNC_TOKEN), nextSyncToken);

  // --- PUSH: chores -> Google events (scoped)
  const chores = await prisma.chore.findMany({
    where: { householdId, status: { in: ["active", "completed"] }, dueDate: { not: null } }
  });
  for (const ch of chores) {
    if (!ch.dueDate) continue;
    const needsPush = !ch.googleEventId || !ch.googleSyncedAt || ch.updatedAt > ch.googleSyncedAt;
    if (!needsPush) continue;
    const body: calendar_v3.Schema$Event = {
      summary: (ch.status === "completed" ? "✓ " : "") + ch.title,
      description: ch.notes ?? undefined,
      start: { date: ch.dueDate.toISOString().slice(0, 10) },
      end: { date: ch.dueDate.toISOString().slice(0, 10) },
      extendedProperties: { private: { familyosChoreId: ch.id } }
    };
    if (!ch.googleEventId) {
      try {
        const res = await cal.events.insert({ calendarId, requestBody: body });
        if (res.data.id) {
          await prisma.chore.update({
            where: { id: ch.id },
            data: { googleEventId: res.data.id, googleSyncedAt: new Date() }
          });
          pushed++;
        }
      } catch {
        /* per-event swallow */
      }
    } else {
      try {
        await cal.events.patch({ calendarId, eventId: ch.googleEventId, requestBody: body });
        await prisma.chore.update({ where: { id: ch.id }, data: { googleSyncedAt: new Date() } });
        pushed++;
      } catch (e) {
        const err = e as { code?: number };
        if (err.code === 404) {
          await prisma.chore.update({ where: { id: ch.id }, data: { googleEventId: null } });
        }
      }
    }
  }

  // Cleanup archived chores
  const archived = await prisma.chore.findMany({
    where: { householdId, status: "archived", googleEventId: { not: null } }
  });
  for (const ch of archived) {
    if (!ch.googleEventId) continue;
    try {
      await cal.events.delete({ calendarId, eventId: ch.googleEventId });
    } catch {
      /* ignore */
    }
    await prisma.chore.update({ where: { id: ch.id }, data: { googleEventId: null } });
  }

  await setSetting(k(householdId, LAST_SYNC), new Date().toISOString());
  return { pulled, pushed };
}

/** Sync every household that has Google connected. Used by cron. */
export async function syncAllHouseholds(): Promise<
  Array<{ householdId: string; pulled?: number; pushed?: number; error?: string }>
> {
  const households = await prisma.household.findMany({ select: { id: true } });
  const out: Array<{ householdId: string; pulled?: number; pushed?: number; error?: string }> = [];
  for (const h of households) {
    try {
      const connected = await isGoogleConnected(h.id);
      if (!connected) continue;
      const r = await syncGoogleCalendar(h.id);
      out.push({ householdId: h.id, ...r });
    } catch (e) {
      out.push({ householdId: h.id, error: (e as Error).message });
    }
  }
  return out;
}
