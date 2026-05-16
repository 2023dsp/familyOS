import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "./prisma";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const SETTING_REFRESH = "google_refresh_token";
const SETTING_EMAIL = "google_account_email";
const SETTING_CAL_ID = "google_calendar_id";
const SETTING_SYNC_TOKEN = "google_sync_token";
const SETTING_LAST_SYNC = "google_last_sync_at";

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
    prompt: "consent", // force refresh_token even on re-auth
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

export async function isGoogleConnected(): Promise<boolean> {
  return (await getSetting(SETTING_REFRESH)) != null;
}

export async function getGoogleStatus(): Promise<{
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
}> {
  const [refresh, email, calId, last] = await Promise.all([
    getSetting(SETTING_REFRESH),
    getSetting(SETTING_EMAIL),
    getSetting(SETTING_CAL_ID),
    getSetting(SETTING_LAST_SYNC)
  ]);
  return {
    connected: refresh != null,
    email,
    calendarId: calId,
    lastSyncAt: last
  };
}

export async function persistTokensFromCode(code: string): Promise<void> {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token. Re-run the connect flow.");
  }
  oauth.setCredentials(tokens);

  // Pick the primary calendar by default
  const cal = google.calendar({ version: "v3", auth: oauth });
  let calendarId = "primary";
  let email: string | null = null;
  try {
    const me = await cal.calendarList.get({ calendarId: "primary" });
    if (me.data.id) calendarId = me.data.id;
    if (me.data.summary) email = me.data.summary;
  } catch {
    // fall back to "primary" alias
  }

  await setSetting(SETTING_REFRESH, tokens.refresh_token);
  await setSetting(SETTING_CAL_ID, calendarId);
  if (email) await setSetting(SETTING_EMAIL, email);
  await clearSetting(SETTING_SYNC_TOKEN); // force full re-sync
}

export async function disconnectGoogle(): Promise<void> {
  await Promise.all([
    clearSetting(SETTING_REFRESH),
    clearSetting(SETTING_EMAIL),
    clearSetting(SETTING_CAL_ID),
    clearSetting(SETTING_SYNC_TOKEN),
    clearSetting(SETTING_LAST_SYNC)
  ]);
  await prisma.chore.updateMany({ data: { googleEventId: null, googleSyncedAt: null } });
  await prisma.calendarEvent.deleteMany({ where: { source: "google" } });
}

async function getAuthedClient(): Promise<{ oauth: OAuth2Client; calendarId: string } | null> {
  const refresh = await getSetting(SETTING_REFRESH);
  if (!refresh) return null;
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: refresh });
  const calendarId = (await getSetting(SETTING_CAL_ID)) ?? "primary";
  return { oauth, calendarId };
}

export async function syncGoogleCalendar(): Promise<{ pulled: number; pushed: number }> {
  const ctx = await getAuthedClient();
  if (!ctx) throw new Error("Google not connected");
  const { oauth, calendarId } = ctx;
  const cal = google.calendar({ version: "v3", auth: oauth });

  const syncToken = await getSetting(SETTING_SYNC_TOKEN);
  let pulled = 0;
  let pushed = 0;

  // --- PULL: Google events → CalendarEvent table ---
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
          await prisma.calendarEvent.deleteMany({ where: { externalId: ev.id } });
          continue;
        }
        const startsAt = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
        const endsAt = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : null;
        if (!startsAt) continue;
        await prisma.calendarEvent.upsert({
          where: { externalId: ev.id },
          create: {
            externalId: ev.id,
            title: ev.summary ?? "(no title)",
            description: ev.description ?? null,
            startsAt,
            endsAt,
            allDay: !ev.start?.dateTime,
            calendar: calendarId,
            color: null,
            source: "google"
          },
          update: {
            title: ev.summary ?? "(no title)",
            description: ev.description ?? null,
            startsAt,
            endsAt,
            allDay: !ev.start?.dateTime
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
      // sync token expired — drop and full resync next time
      await clearSetting(SETTING_SYNC_TOKEN);
      throw new Error("Sync token expired — try sync again to do a full refresh.");
    }
    throw e;
  }

  if (nextSyncToken) await setSetting(SETTING_SYNC_TOKEN, nextSyncToken);

  // --- PUSH: chores with dueDate → Google events ---
  const chores = await prisma.chore.findMany({
    where: { status: { in: ["active", "completed"] }, dueDate: { not: null } }
  });
  for (const ch of chores) {
    if (!ch.dueDate) continue;
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
        /* swallow per-event errors so one bad chore doesn't kill the loop */
      }
    } else {
      try {
        await cal.events.patch({ calendarId, eventId: ch.googleEventId, requestBody: body });
        await prisma.chore.update({ where: { id: ch.id }, data: { googleSyncedAt: new Date() } });
        pushed++;
      } catch (e) {
        const err = e as { code?: number };
        if (err.code === 404) {
          // event was deleted on Google side; recreate next sync
          await prisma.chore.update({ where: { id: ch.id }, data: { googleEventId: null } });
        }
      }
    }
  }

  // Cleanup: archived chores → delete their event
  const archived = await prisma.chore.findMany({
    where: { status: "archived", googleEventId: { not: null } }
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

  await setSetting(SETTING_LAST_SYNC, new Date().toISOString());
  return { pulled, pushed };
}
