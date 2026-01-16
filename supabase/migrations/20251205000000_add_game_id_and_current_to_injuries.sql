-- ============================================================================
-- ADD GAME_ID AND IS_CURRENT TO NBA_INJURIES
-- ============================================================================
-- Links injuries to specific games and tracks if injury is current (on latest report)
-- ============================================================================

-- Add game_id column to link injuries to specific games
ALTER TABLE public.nba_injuries
ADD COLUMN IF NOT EXISTS game_id VARCHAR(50);

-- Add is_current flag to track if injury is on the latest injury report
ALTER TABLE public.nba_injuries
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;

-- Add report_timestamp to track when the injury report was published
ALTER TABLE public.nba_injuries
ADD COLUMN IF NOT EXISTS report_timestamp TIMESTAMPTZ;

-- Add index for game_id lookups
CREATE INDEX IF NOT EXISTS idx_nba_injuries_game_id 
ON nba_injuries(game_id) 
WHERE game_id IS NOT NULL;

-- Add index for current injuries (most common query)
CREATE INDEX IF NOT EXISTS idx_nba_injuries_current 
ON nba_injuries(nba_player_id, is_current, date_updated DESC) 
WHERE is_current = TRUE AND injury_status IN ('Out', 'Questionable', 'Day-to-Day');

-- Add index for report_timestamp to find latest report
CREATE INDEX IF NOT EXISTS idx_nba_injuries_report_timestamp 
ON nba_injuries(report_timestamp DESC) 
WHERE report_timestamp IS NOT NULL;

-- Add foreign key constraint to nba_games (if table exists)
-- Note: Using IF NOT EXISTS pattern for safety
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nba_games') THEN
    -- Add foreign key if nba_games table exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_nba_injuries_game_id'
    ) THEN
      ALTER TABLE public.nba_injuries
      ADD CONSTRAINT fk_nba_injuries_game_id 
      FOREIGN KEY (game_id) 
      REFERENCES nba_games(game_id) 
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Update existing injuries to be marked as current (one-time migration)
UPDATE public.nba_injuries
SET is_current = TRUE
WHERE is_current IS NULL;

-- ============================================================================
-- UPDATE VIEW: Active Injuries (only show current injuries)
-- ============================================================================
-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS active_injuries;

-- Recreate the view with updated columns
CREATE VIEW active_injuries AS
SELECT DISTINCT ON (nba_player_id)
  i.*,
  p.name as player_name,
  p.position,
  p.team_abbreviation,
  p.team_name
FROM nba_injuries i
JOIN nba_players p ON i.nba_player_id = p.nba_player_id
WHERE i.injury_status IN ('Out', 'Questionable', 'Day-to-Day')
  AND i.is_current = TRUE
ORDER BY i.nba_player_id, i.date_updated DESC;

-- Add comments
COMMENT ON COLUMN nba_injuries.game_id IS 'Links to nba_games.game_id for the specific game the injury affects';
COMMENT ON COLUMN nba_injuries.is_current IS 'TRUE if this injury is on the latest injury report, FALSE if player is no longer on report';
COMMENT ON COLUMN nba_injuries.report_timestamp IS 'Timestamp when the injury report was published (used to determine latest report)';

