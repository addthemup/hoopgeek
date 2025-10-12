-- ============================================================================
-- Weekly Lineup System
-- ============================================================================
-- This migration adds support for weekly lineups that are separate from rosters.
-- Each week, teams set a lineup with Starters, Rotation, and Bench players
-- from their roster. Each tier has a fantasy points multiplier.

-- ============================================================================
-- Step 1: Add lineup configuration to league_settings
-- ============================================================================

-- Add columns for lineup settings
ALTER TABLE league_settings
ADD COLUMN IF NOT EXISTS starters_count INTEGER DEFAULT 5 NOT NULL CHECK (starters_count = 5),
ADD COLUMN IF NOT EXISTS starters_multiplier DECIMAL(4,2) DEFAULT 1.0 NOT NULL CHECK (starters_multiplier >= 0 AND starters_multiplier <= 2.0),
ADD COLUMN IF NOT EXISTS rotation_count INTEGER DEFAULT 5 NOT NULL CHECK (rotation_count >= 3 AND rotation_count <= 7),
ADD COLUMN IF NOT EXISTS rotation_multiplier DECIMAL(4,2) DEFAULT 0.75 NOT NULL CHECK (rotation_multiplier >= 0 AND rotation_multiplier <= 2.0),
ADD COLUMN IF NOT EXISTS bench_count INTEGER DEFAULT 3 NOT NULL CHECK (bench_count >= 3 AND bench_count <= 5),
ADD COLUMN IF NOT EXISTS bench_multiplier DECIMAL(4,2) DEFAULT 0.5 NOT NULL CHECK (bench_multiplier >= 0 AND bench_multiplier <= 2.0);

-- Add comments
COMMENT ON COLUMN league_settings.starters_count IS 'Number of starting players in weekly lineup (locked at 5)';
COMMENT ON COLUMN league_settings.starters_multiplier IS 'Fantasy points multiplier for starters (default 1.0 = 100%)';
COMMENT ON COLUMN league_settings.rotation_count IS 'Number of rotation players in weekly lineup (3-7)';
COMMENT ON COLUMN league_settings.rotation_multiplier IS 'Fantasy points multiplier for rotation players (default 0.75 = 75%)';
COMMENT ON COLUMN league_settings.bench_count IS 'Number of bench players in weekly lineup (3-5)';
COMMENT ON COLUMN league_settings.bench_multiplier IS 'Fantasy points multiplier for bench players (default 0.5 = 50%)';

-- ============================================================================
-- Step 2: Create weekly_lineups table
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL, -- e.g., 2025, 2026 (for dynasty leagues)
  week_number INTEGER NOT NULL, -- 0 (preseason), 1-25 (regular + playoffs)
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  lineup_tier TEXT NOT NULL CHECK (lineup_tier IN ('starter', 'rotation', 'bench')),
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0, -- Denormalized for quick scoring
  is_locked BOOLEAN DEFAULT false, -- True once the week starts
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each player can only appear once per team per week
  UNIQUE(league_id, fantasy_team_id, season_year, week_number, player_id),
  
  -- Ensure week number is valid (0-25)
  CONSTRAINT valid_week_number CHECK (week_number >= 0 AND week_number <= 25)
);

-- Create indexes for efficient queries
CREATE INDEX idx_weekly_lineups_league ON weekly_lineups(league_id);
CREATE INDEX idx_weekly_lineups_team ON weekly_lineups(fantasy_team_id);
CREATE INDEX idx_weekly_lineups_season_week ON weekly_lineups(season_year, week_number);
CREATE INDEX idx_weekly_lineups_team_week ON weekly_lineups(fantasy_team_id, season_year, week_number);
CREATE INDEX idx_weekly_lineups_player ON weekly_lineups(player_id);
CREATE INDEX idx_weekly_lineups_tier ON weekly_lineups(lineup_tier);
CREATE INDEX idx_weekly_lineups_locked ON weekly_lineups(is_locked);

-- Add comments
COMMENT ON TABLE weekly_lineups IS 'Weekly lineups for each team. Players from roster are assigned to starter, rotation, or bench tiers with point multipliers.';
COMMENT ON COLUMN weekly_lineups.lineup_tier IS 'Player tier: starter (5 players), rotation (3-7 players), or bench (3-5 players)';
COMMENT ON COLUMN weekly_lineups.multiplier IS 'Fantasy points multiplier for this player based on their tier';
COMMENT ON COLUMN weekly_lineups.is_locked IS 'True when the week starts and lineup can no longer be changed';

-- ============================================================================
-- Step 3: Create trigger to update updated_at
-- ============================================================================

CREATE TRIGGER update_weekly_lineups_updated_at 
    BEFORE UPDATE ON weekly_lineups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 4: Create helper function to validate lineup
-- ============================================================================

-- Drop existing function first (parameter names may differ)
DROP FUNCTION IF EXISTS validate_lineup_size(UUID, UUID, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION validate_lineup_size(
  p_league_id UUID,
  p_fantasy_team_id UUID,
  p_season_year INTEGER,
  p_week_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_roster_size INTEGER;
  v_lineup_size INTEGER;
  v_starters_count INTEGER;
  v_rotation_count INTEGER;
  v_bench_count INTEGER;
  v_starters_actual INTEGER;
  v_rotation_actual INTEGER;
  v_bench_actual INTEGER;
BEGIN
  -- Get roster size from league settings
  SELECT 
    COALESCE((roster_positions->>'PG')::INTEGER, 0) +
    COALESCE((roster_positions->>'SG')::INTEGER, 0) +
    COALESCE((roster_positions->>'SF')::INTEGER, 0) +
    COALESCE((roster_positions->>'PF')::INTEGER, 0) +
    COALESCE((roster_positions->>'C')::INTEGER, 0) +
    COALESCE((roster_positions->>'G')::INTEGER, 0) +
    COALESCE((roster_positions->>'F')::INTEGER, 0) +
    COALESCE((roster_positions->>'UTIL')::INTEGER, 0) +
    COALESCE((roster_positions->>'BENCH')::INTEGER, 0)
  INTO v_roster_size
  FROM league_settings
  WHERE league_id = p_league_id;
  
  -- Get expected lineup configuration
  SELECT 
    starters_count,
    rotation_count,
    bench_count
  INTO v_starters_count, v_rotation_count, v_bench_count
  FROM league_settings
  WHERE league_id = p_league_id;
  
  -- Get actual lineup counts
  SELECT 
    COUNT(*) FILTER (WHERE lineup_tier = 'starter'),
    COUNT(*) FILTER (WHERE lineup_tier = 'rotation'),
    COUNT(*) FILTER (WHERE lineup_tier = 'bench'),
    COUNT(*)
  INTO v_starters_actual, v_rotation_actual, v_bench_actual, v_lineup_size
  FROM weekly_lineups
  WHERE league_id = p_league_id
    AND fantasy_team_id = p_fantasy_team_id
    AND season_year = p_season_year
    AND week_number = p_week_number;
  
  -- Validate lineup size doesn't exceed roster
  IF v_lineup_size > v_roster_size THEN
    RAISE EXCEPTION 'Lineup size (%) exceeds roster size (%)', v_lineup_size, v_roster_size;
  END IF;
  
  -- Validate tier counts
  IF v_starters_actual != v_starters_count THEN
    RAISE EXCEPTION 'Invalid starters count: expected %, got %', v_starters_count, v_starters_actual;
  END IF;
  
  IF v_rotation_actual != v_rotation_count THEN
    RAISE EXCEPTION 'Invalid rotation count: expected %, got %', v_rotation_count, v_rotation_actual;
  END IF;
  
  IF v_bench_actual != v_bench_count THEN
    RAISE EXCEPTION 'Invalid bench count: expected %, got %', v_bench_count, v_bench_actual;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_lineup_size IS 'Validates that a weekly lineup meets size requirements and tier distribution';

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_lineup_size TO authenticated;

-- ============================================================================
-- Step 5: Create function to lock lineups when week starts
-- ============================================================================

-- Drop existing function first (parameter names may differ)
DROP FUNCTION IF EXISTS lock_lineups_for_week(UUID, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION lock_lineups_for_week(
  p_league_id UUID,
  p_season_year INTEGER,
  p_week_number INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_locked_count INTEGER;
BEGIN
  -- Lock all lineups for the specified week
  UPDATE weekly_lineups
  SET is_locked = true, updated_at = NOW()
  WHERE league_id = p_league_id
    AND season_year = p_season_year
    AND week_number = p_week_number
    AND is_locked = false;
  
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  
  RETURN v_locked_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION lock_lineups_for_week IS 'Locks all lineups for a specific week when the week starts';

-- Grant permissions
GRANT EXECUTE ON FUNCTION lock_lineups_for_week TO authenticated;

-- ============================================================================
-- Step 6: Enable RLS on weekly_lineups
-- ============================================================================

ALTER TABLE weekly_lineups ENABLE ROW LEVEL SECURITY;

-- Allow team owners to manage their lineups (when not locked)
CREATE POLICY "Allow team owners to manage their unlocked lineups" ON weekly_lineups
  FOR ALL USING (
    fantasy_team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    ) AND is_locked = false
  );

-- Allow team owners to read their locked lineups
CREATE POLICY "Allow team owners to read their lineups" ON weekly_lineups
  FOR SELECT USING (
    fantasy_team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

-- Allow commissioners to manage all lineups in their leagues
CREATE POLICY "Allow commissioners to manage lineups in their leagues" ON weekly_lineups
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

-- Allow league members to read all lineups in their leagues
CREATE POLICY "Allow league members to read lineups" ON weekly_lineups
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Step 7: Update league_settings defaults for existing leagues
-- ============================================================================

-- Update existing leagues to have default lineup settings
UPDATE league_settings
SET 
  starters_count = 5,
  starters_multiplier = 1.0,
  rotation_count = 5,
  rotation_multiplier = 0.75,
  bench_count = 3,
  bench_multiplier = 0.5
WHERE starters_count IS NULL;

