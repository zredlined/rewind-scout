-- Full bootstrap for FRC scouting app (team-code auth)
-- Drops all app tables and recreates from scratch.
-- Run in Supabase SQL editor.

-- 1. Drop everything in dependency order
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS scouting_entries CASCADE;
DROP TABLE IF EXISTS pit_entries CASCADE;
DROP TABLE IF EXISTS form_templates CASCADE;
DROP TABLE IF EXISTS pit_templates CASCADE;
DROP TABLE IF EXISTS frc_teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS scouts CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- 2. Teams (one row per FRC team using the app)
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number int UNIQUE NOT NULL,
  team_name text NOT NULL,
  join_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Scouts (users, identified by team + display name)
CREATE TABLE scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, display_name)
);

-- 4. Dynamic form templates per season
CREATE TABLE form_templates (
  season int PRIMARY KEY,
  form_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE pit_templates (
  season int PRIMARY KEY,
  form_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. Scouting entries (append-only)
CREATE TABLE scouting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season int NOT NULL,
  event_code text NOT NULL,
  match_key text NOT NULL,
  team_number int NOT NULL,
  scout_id uuid,
  scout_name text,
  scouted_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE pit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season int NOT NULL,
  event_code text NOT NULL,
  team_number int NOT NULL,
  scout_id uuid,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 6. TBA reference tables
CREATE TABLE frc_teams (
  number int PRIMARY KEY,
  nickname text,
  name text,
  logo_url text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  start_date date,
  end_date date
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  match_key text NOT NULL,
  red_teams int[] NOT NULL,
  blue_teams int[] NOT NULL,
  scheduled_at timestamptz,
  UNIQUE(event_id, match_key)
);

-- 7. Indexes
CREATE INDEX idx_scout_entries_team ON scouting_entries(team_number);
CREATE INDEX idx_scout_entries_event_match ON scouting_entries(event_code, match_key);
CREATE INDEX idx_scout_entries_metrics_gin ON scouting_entries USING gin (metrics);
CREATE INDEX idx_scout_entries_scouted_at ON scouting_entries(scouted_at);

-- 8. Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE frc_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 9. Open RLS policies (auth is handled at the app layer via JWT cookies)
CREATE POLICY "open" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON scouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON form_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON pit_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON scouting_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON pit_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON frc_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open" ON matches FOR ALL USING (true) WITH CHECK (true);

-- 10. Storage bucket for pit photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pit-photos', 'pit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Open storage policies for pit-photos bucket
DROP POLICY IF EXISTS "open_upload" ON storage.objects;
DROP POLICY IF EXISTS "open_read" ON storage.objects;
CREATE POLICY "open_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pit-photos');
CREATE POLICY "open_read" ON storage.objects FOR SELECT USING (bucket_id = 'pit-photos');
