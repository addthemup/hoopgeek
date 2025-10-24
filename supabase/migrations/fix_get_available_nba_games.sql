-- ============================================================================
-- Fix get_available_nba_games_for_dfs Function
-- ============================================================================
-- Updates function to use correct column names and timezone handling
-- ============================================================================

-- Drop the old function first
DROP FUNCTION IF EXISTS get_available_nba_games_for_dfs(date);

CREATE OR REPLACE FUNCTION get_available_nba_games_for_dfs(
  p_date DATE
)
RETURNS TABLE(
  game_id VARCHAR(50),
  game_date TIMESTAMPTZ,
  home_team VARCHAR(10),
  away_team VARCHAR(10),
  home_team_name TEXT,
  away_team_name TEXT,
  venue TEXT,
  game_status TEXT,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.game_id,
    g.game_date,
    g.home_team_tricode,
    g.away_team_tricode,
    g.home_team_name::TEXT,
    g.away_team_name::TEXT,
    g.arena_name::TEXT as venue,
    g.game_status_text::TEXT as game_status,
    (g.game_status_text != 'Final' OR g.game_status_text IS NULL) as is_available
  FROM nba_games g
  WHERE 
    -- Match games on the selected date (UTC)
    -- OR games early next day (midnight-6am UTC = 7pm-1am ET previous day)
    (
      DATE(g.game_date) = p_date
      OR (DATE(g.game_date) = p_date + 1 AND EXTRACT(HOUR FROM g.game_date) <= 6)
    )
    AND g.season_year = 2025
  ORDER BY g.game_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_nba_games_for_dfs IS
'Gets all NBA games for a specific date (in EST) that can be included in a DFS slate.
Used by admin to select which games to include in a pool.
Fixed to use correct column names and timezone conversion.';

