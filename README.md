This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
# FRC Scouting App (Single‑Team, Dynamic Form)

A fast, mobile‑friendly scouting app for FRC teams. Designed to be simple to run for one team with a dynamic, per‑season form builder. Future versions can add offline syncing and multi‑team support.

## Features
- Google/email sign‑in via Supabase Auth
- Check‑in flow: pick season/event, auto‑import matches via TBA (The Blue Alliance)
- Dynamic Form Builder per season (no code changes needed for new games)
- Scouting form: append‑only entries with metrics JSON
- Analysis: summary cards (Team vs Others), team progression charts, recent comments
- Admin tools: export CSV, delete last 24h or all entries

## Stack
- Next.js (App Router, TypeScript) deployed on Vercel
- Supabase (Postgres + Auth)
- Recharts (charts)

## Prerequisites
- Supabase project (URL, anon key, service role key)
- Vercel account
- (Optional) The Blue Alliance API Read Key

## Environment variables
Set in Vercel Project Settings → Environment Variables (and `.env.local` for local dev):

- `NEXT_PUBLIC_SUPABASE_URL` = https://<YOUR_PROJECT_REF>.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key (server‑only)
- `TBA_AUTH_KEY` = TBA API Read Key (server‑only)

Create `.env.local` for local dev:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TBA_AUTH_KEY=your_tba_key
```

## Bootstrap the database
Run the SQL in `sql/bootstrap.sql` inside Supabase SQL editor. It creates:
- `form_templates` (season form definition)
- `scouting_entries` (append‑only submissions)
- permissive RLS policies (any authenticated user can read/write)
- helpful indexes
- minimal `events` and `matches` tables used by TBA import

File: `sql/bootstrap.sql`

If you need to add policies manually, note: Postgres does not support `create policy if not exists`. Use:
```sql
drop policy if exists "events read (auth)" on events;
create policy "events read (auth)" on events for select using (auth.uid() is not null);

drop policy if exists "matches read (auth)" on matches;
create policy "matches read (auth)" on matches for select using (auth.uid() is not null);
```

## Local development
```bash
npm i
npm run dev
```
Open http://localhost:3000. Ensure Supabase URL/keys are set in `.env.local`.

## Deployment
- Push to GitHub → Vercel auto‑builds
- Set env vars in Vercel (see above)
- Supabase Auth → Providers → enable Google; set Site URL to your Vercel domain

## Usage
- Check‑in at `/check-in` (season → load events → choose event). We import matches and set your current event.
- Form Builder at `/form-builder` (choose season, add fields: counter/checkbox/text, Save)
- Scouting at `/scout` (match picker or type match, enter metrics, Submit)
- Analysis at `/analysis` (enter team number; toggle Current event/Current season)
- Admin at `/admin` (export CSV, delete last 24h, delete all) — not linked in nav

## Resetting data before an event
- Easiest: visit `/admin` and use Delete last 24h or Delete ALL
- SQL option (delete all scouting entries):
```sql
delete from scouting_entries where true;
```
- SQL option (delete entries for current event only):
```sql
-- replace 2026miket with your event code
delete from scouting_entries where event_code = '2026miket';
```
- To reset a season’s form template:
```sql
delete from form_templates where season = 2026;
```

## Docs / Plan
See `docs/plan.md` for the current product/engineering plan and future roadmap (offline sync and multi‑team).

## Roadmap (future)
- Offline‑first (IndexedDB outbox + idempotent sync)
- Multi‑team, invitations, and per‑team data isolation (RLS)
- Auto insights in analysis (strengths/weaknesses)

## License
See `LICENSE`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
