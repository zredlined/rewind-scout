-- Minimal schema for single-team FRC scouting app
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

-- Dynamic form templates per season
create table if not exists form_templates (
  season int primary key,
  form_definition jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Scouting entries (append-only)
create table if not exists scouting_entries (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  event_code text not null,
  match_key text not null,
  team_number int not null,
  scout_id uuid,
  scout_name text,
  scouted_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- TBA reference tables (used by import)
-- FRC Teams (names/logos) - use a separate table name to avoid collisions
create table if not exists frc_teams (
  number int primary key,
  nickname text,
  name text,
  logo_url text,
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  start_date date,
  end_date date
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  match_key text not null,
  red_teams int[] not null,
  blue_teams int[] not null,
  scheduled_at timestamptz,
  unique(event_id, match_key)
);

-- Indexes
create index if not exists idx_scout_entries_team on scouting_entries(team_number);
create index if not exists idx_scout_entries_event_match on scouting_entries(event_code, match_key);
create index if not exists idx_scout_entries_metrics_gin on scouting_entries using gin (metrics);
create index if not exists idx_scout_entries_scouted_at on scouting_entries(scouted_at);

-- Row Level Security (permissive for authenticated users)
alter table form_templates enable row level security;
alter table scouting_entries enable row level security;
alter table events enable row level security;
alter table matches enable row level security;
alter table frc_teams enable row level security;

drop policy if exists "form_templates rw auth" on form_templates;
create policy "form_templates rw auth" on form_templates
for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "scouting_entries rw auth" on scouting_entries;
create policy "scouting_entries rw auth" on scouting_entries
for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "events read (auth)" on events;
drop policy if exists "events rw (auth)" on events;
create policy "events rw (auth)" on events
for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "matches read (auth)" on matches;
drop policy if exists "matches rw (auth)" on matches;
create policy "matches rw (auth)" on matches
for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "frc_teams rw (auth)" on frc_teams;
create policy "frc_teams rw (auth)" on frc_teams
for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Pit scouting tables
create table if not exists pit_templates (
  season int primary key,
  form_definition jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists pit_entries (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  event_code text not null,
  team_number int not null,
  scout_id uuid,
  metrics jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table pit_templates enable row level security;
alter table pit_entries enable row level security;

drop policy if exists "pit_templates rw (auth)" on pit_templates;
create policy "pit_templates rw (auth)" on pit_templates
for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "pit_entries rw (auth)" on pit_entries;
create policy "pit_entries rw (auth)" on pit_entries
for all using (auth.uid() is not null) with check (auth.uid() is not null);


