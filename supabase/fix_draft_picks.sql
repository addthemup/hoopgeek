-- Fix draft_picks table if it already exists
-- This script handles the case where draft_picks table already exists

-- Drop the existing table and recreate it with the correct structure
DROP TABLE IF EXISTS draft_picks CASCADE;

-- Create draft_picks table to store completed picks
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, pick_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_draft_picks_league ON draft_picks(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_pick_number ON draft_picks(league_id, pick_number);

-- Enable RLS
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow league members to read draft picks" ON draft_picks;
CREATE POLICY "Allow league members to read draft picks" ON draft_picks
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE id IN (
        SELECT league_id FROM league_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Allow commissioners to create draft picks" ON draft_picks;
CREATE POLICY "Allow commissioners to create draft picks" ON draft_picks
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow commissioners to update draft picks" ON draft_picks;
CREATE POLICY "Allow commissioners to update draft picks" ON draft_picks
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow commissioners to delete draft picks" ON draft_picks;
CREATE POLICY "Allow commissioners to delete draft picks" ON draft_picks
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );
