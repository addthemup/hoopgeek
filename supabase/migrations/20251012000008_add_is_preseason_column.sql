-- ============================================================================
-- Add is_preseason Column to weekly_matchups
-- ============================================================================
-- This migration adds a flag to distinguish preseason (Week 0) matchups
-- from regular season and playoff matchups. Preseason games are practice
-- and don't count towards standings.

-- Add the is_preseason column
ALTER TABLE weekly_matchups 
ADD COLUMN IF NOT EXISTS is_preseason BOOLEAN DEFAULT false NOT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_weekly_matchups_is_preseason 
ON weekly_matchups(is_preseason);

-- Create composite index for common queries (filtering by league and preseason status)
CREATE INDEX IF NOT EXISTS idx_weekly_matchups_league_preseason 
ON weekly_matchups(league_id, is_preseason);

-- Add comment to explain the column
COMMENT ON COLUMN weekly_matchups.is_preseason IS 'True for Week 0 (preseason) practice games that do not count in standings. False for all regular season and playoff games.';

-- Update any existing Week 0 matchups to be marked as preseason
UPDATE weekly_matchups 
SET is_preseason = true 
WHERE week_number = 0;

-- Update all other matchups to explicitly be false
UPDATE weekly_matchups 
SET is_preseason = false 
WHERE week_number > 0;

