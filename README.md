# FamilyOS

A warm, self-hosted **family operations dashboard** — chores, recurring tasks, and a
read-only calendar shelf. Designed for a wall-mounted Android tablet plus PWA on phones.

Stack: **Next.js 15 · React 18 · TypeScript · Tailwind · PostgreSQL · Prisma · Docker**.

No SaaS dependencies. No user accounts. One shared family password.

## What you get

- **Tablet dashboard** — landscape kiosk layout: today's chores, weekly progress, household
  score, recurring auto-schedule, calendar shelf.
- **Mobile PWA** — same data, mobile-first stack with filter chips and a bottom tab bar.
- **Chore CRUD** with category + assignee + priority + recurrence (daily / weekly / monthly
  / every X days / every X weeks / every X months).
- **Recurring engine** — completing a recurring chore schedules the next occurrence
  automatically, preserving its configuration.
- **Local rule-based suggestions** for icon / category / priority / recurrence based on the
  chore title (e.g. *"change tires every 6 months"*). Pluggable provider — you can wire
  OpenAI later without touching the UI.
- **Templates** (Clean garden, Buy bulbs, Change tires, Take out trash, Pay bill, …) ready
  to one-tap into your list.
- **Light gamification**: completed today count, weekly %, household score, streak.
- **Shared-password auth**: HMAC-signed session cookie, no DB-stored plaintext, basic
  per-IP login rate limiting.
- **PWA**: manifest, service worker, offline app shell, installable on Android tablet.

## Project layout

```
prisma/         # schema.prisma + seed.ts (templates, family members, sample chores)
public/         # manifest.webmanifest, sw.js, icons
src/app/        # Next.js App Router: /, /login, /api/*
src/components/ # Dashboard, ChoreRow, AddChoreModal, ChoreDetailModal, …
src/lib/        # auth, prisma, suggest, recurrence, chores, date, rate-limit
docker/         # entrypoint that runs migrations + seed then starts Next
Dockerfile
docker-compose.yml
```

## Run locally

```bash
cp .env.example .env             # fill FAMILY_ACCESS_PASSWORD + SESSION_SECRET
npm install
docker compose up -d db          # or run your own PostgreSQL and adjust DATABASE_URL
npx prisma migrate dev --name init
npm run db:seed
npm run dev
# open http://localhost:3000
```

`SESSION_SECRET` can be generated with `openssl rand -hex 32`.

## Run with Docker (single command)

```bash
cp .env.example .env             # set FAMILY_ACCESS_PASSWORD + SESSION_SECRET
docker compose up -d --build
```

The `app` container will automatically:

1. wait for PostgreSQL,
2. run `prisma migrate deploy`,
3. seed templates and family members (idempotent),
4. start the Next.js server on `:3000`.

## Deploy to Hetzner

1. **Provision** a Hetzner Cloud VPS (CPX21 is plenty). Ubuntu 22.04+.
2. SSH in and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt-get install -y docker-compose-plugin
   ```
3. **Clone** the repo and copy `.env`:
   ```bash
   git clone <your-repo> familyos && cd familyos
   cp .env.example .env
   nano .env   # set FAMILY_ACCESS_PASSWORD, SESSION_SECRET, NEXT_PUBLIC_FAMILY_NAMES
   ```
4. **Build & start**:
   ```bash
   docker compose up -d --build
   ```
5. **HTTPS / domain** (Caddy is easiest — single config block):
   ```caddy
   family.example.com {
     reverse_proxy localhost:3000
   }
   ```
   Or use Nginx + certbot. Point your DNS A record at the VPS IP.

   Don't forget: open firewall ports `80` and `443` only — leave `3000`
   bound to localhost.

6. **Persistence**: Postgres data lives in the named volume `familyos-pg`. Back it up with
   `docker exec familyos-db-1 pg_dump -U familyos familyos > backup.sql`.

7. **Updates**:
   ```bash
   git pull && docker compose up -d --build
   ```
   Migrations and seed run automatically on container start.

## Tablet kiosk setup (Android)

1. Open the deployed URL in Chrome → **Add to Home screen**.
2. Launch from home screen — the app runs fullscreen via the PWA manifest.
3. For an always-on display, use any kiosk launcher (e.g. *Fully Kiosk Browser*) and point
   it at the URL with cookie persistence enabled.

## Environment variables

| Name                          | Required | Description                                                                       |
|-------------------------------|----------|-----------------------------------------------------------------------------------|
| `DATABASE_URL`                | yes      | Postgres connection string. With `docker-compose` defaults to the bundled `db`.   |
| `FAMILY_ACCESS_PASSWORD`      | yes*     | The shared family password (hashed at boot, never stored plaintext).              |
| `FAMILY_ACCESS_PASSWORD_HASH` | yes*     | Or precomputed SHA-256 hex hash if you don't want the plain password in env.      |
| `SESSION_SECRET`              | yes      | HMAC secret for the session cookie. Use at least 32 random bytes.                 |
| `SESSION_DAYS`                | no       | Session lifetime in days (default `30`).                                          |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | no | Placeholders for future Google Calendar OAuth wiring. |
| `OPENAI_API_KEY`              | no       | Reserved for an AI suggestion provider in a future release.                       |
| `NEXT_PUBLIC_APP_NAME`        | no       | Shown in the header. Defaults to `FamilyOS`.                                      |
| `NEXT_PUBLIC_FAMILY_NAMES`    | no       | Shown in the header and login screen. Defaults to `Davide & Luize`.               |

\* set at least one of `FAMILY_ACCESS_PASSWORD` or `FAMILY_ACCESS_PASSWORD_HASH`.

## Known limitations (intentional MVP scope)

- No multi-tenant / no per-user identities — single shared family password.
- Google Calendar is read-only and currently a placeholder; OAuth wiring is deliberately
  left out of v1.
- AI suggestions are local rule-based. The OpenAI provider stub is documented but not
  implemented yet — replace `defaultSuggestionProvider` in `src/lib/suggest.ts`.
- Calendar grid in `/calendar` is a placeholder until Google sync lands.
- Rate-limiting uses the DB; if you front the app with a proxy, set `X-Forwarded-For`.

## Suggested next improvements

- **Google Calendar OAuth** wired to `CalendarEvent` via a polling job.
- **Voice add** via the Web Speech API (mic icon is already in `AddChoreModal`).
- **Notifications** — Web Push for high-priority recurring chores due today.
- **AI provider** — swap `RuleSuggestionProvider` with an OpenAI-backed one for free-form
  parsing.
- **Per-member streaks** with weekly micro-rewards.
- **Photo proofs** on chore completion — useful for kids/guest mode later.
- **iCal export** of household chores for personal calendars.

## License

Self-hosted, do as you like.
