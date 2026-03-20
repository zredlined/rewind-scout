-- Team-code auth migration
-- Run this in the Supabase SQL editor

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number int UNIQUE NOT NULL,
  team_name text NOT NULL,
  join_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Create scouts table
CREATE TABLE IF NOT EXISTS scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id),
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, display_name)
);

-- 3. Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouts ENABLE ROW LEVEL SECURITY;

-- 4. Open RLS policies on new tables
CREATE POLICY "teams_open" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "scouts_open" ON scouts FOR ALL USING (true) WITH CHECK (true);

-- 5. Update existing table RLS policies from auth.uid() IS NOT NULL to true
-- Drop old policies and recreate with open access (app-level auth now)

-- scouting_entries
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated insert" ON scouting_entries;
  DROP POLICY IF EXISTS "Allow authenticated read" ON scouting_entries;
  DROP POLICY IF EXISTS "Allow authenticated delete" ON scouting_entries;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_insert" ON scouting_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "open_read" ON scouting_entries FOR SELECT USING (true);
CREATE POLICY "open_delete" ON scouting_entries FOR DELETE USING (true);

-- pit_entries
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated insert" ON pit_entries;
  DROP POLICY IF EXISTS "Allow authenticated read" ON pit_entries;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_insert" ON pit_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "open_read" ON pit_entries FOR SELECT USING (true);

-- form_templates
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON form_templates;
  DROP POLICY IF EXISTS "Allow authenticated upsert" ON form_templates;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON form_templates FOR SELECT USING (true);
CREATE POLICY "open_upsert" ON form_templates FOR ALL USING (true) WITH CHECK (true);

-- pit_templates
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON pit_templates;
  DROP POLICY IF EXISTS "Allow authenticated upsert" ON pit_templates;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON pit_templates FOR SELECT USING (true);
CREATE POLICY "open_upsert" ON pit_templates FOR ALL USING (true) WITH CHECK (true);

-- events
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON events;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON events FOR SELECT USING (true);

-- matches
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON matches;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON matches FOR SELECT USING (true);

-- frc_teams
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON frc_teams;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON frc_teams FOR SELECT USING (true);

-- profiles (keep table, open up policies)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
  DROP POLICY IF EXISTS "Allow authenticated upsert" ON profiles;
  DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "open_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "open_write" ON profiles FOR ALL USING (true) WITH CHECK (true);
