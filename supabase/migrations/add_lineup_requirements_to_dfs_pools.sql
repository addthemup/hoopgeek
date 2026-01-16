-- ============================================================================
-- Add Lineup Requirements/Handicaps to DFS Pools
-- ============================================================================
-- This migration adds a JSONB column to store all lineup requirements.
-- All requirements are stored as JSON for flexibility and to avoid having
-- dozens of nullable columns that would mostly be empty.
-- ============================================================================

-- Add the lineup_requirements JSONB column (stores all requirements as JSON)
ALTER TABLE public.dfs_pools
  ADD COLUMN IF NOT EXISTS lineup_requirements JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.dfs_pools.lineup_requirements IS 
'JSONB object containing all lineup requirements/handicaps. Structure:
{
  "min_players_from_teams": [{"team": "UTA", "min": 3}],
  "max_players_from_teams": [{"team": "LAL", "max": 2}],
  "required_player_ids": [12345, 67890],
  "excluded_player_ids": [11111],
  "min_different_teams": 5,
  "max_players_same_team": 3,
  "max_rookies": 2,
  "min_players_per_game": 1,
  "max_players_same_game": 4,
  ... (and many other optional fields)
}';

