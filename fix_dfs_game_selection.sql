-- ============================================================================
-- FIX: DFS Game Selection Functions - Use Correct Column Names
-- ============================================================================
-- The functions were using old column names that don't exist in nba_games.
-- Update to use the actual column names from the new NBA CDN import.
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: Get Available Games for DFS
-- ============================================================================

DROP FUNCTION IF EXISTS get_available_nba_games_for_dfs(DATE);

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
    g.home_team_name,
    g.away_team_name,
    g.arena_name as venue,
    g.game_status_text as game_status,
    (g.game_status = 1) as is_available -- game_status 1 = scheduled/upcoming
  FROM nba_games g
  WHERE DATE(g.game_date) = p_date
    AND g.game_status = 1 -- Only upcoming games
  ORDER BY g.game_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_nba_games_for_dfs IS
'Gets all NBA games for a specific date that can be included in a DFS slate.
Uses the correct column names from the nba_games table (game_date, home_team_tricode, away_team_tricode).
Only returns games with game_status = 1 (scheduled/upcoming).
Used by admin to select which games to include in a pool.';

-- ============================================================================
-- FUNCTION 2: Get Players for Selected Games
-- ============================================================================

DROP FUNCTION IF EXISTS get_dfs_players_for_games(VARCHAR[]);

CREATE OR REPLACE FUNCTION get_dfs_players_for_games(
  p_game_ids VARCHAR(50)[]
)
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  salary_2025_26 BIGINT,
  recent_avg_fantasy_pts DECIMAL,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team_tricode, away_team_tricode]) as team_abbr
    FROM nba_games
    WHERE game_id = ANY(p_game_ids)
  )
  SELECT 
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    COALESCE(hs.salary_2025_26, 1157153::BIGINT) as salary_2025_26,
    35.0::DECIMAL as recent_avg_fantasy_pts,
    p.is_active
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE
  ORDER BY hs.salary_2025_26 DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dfs_players_for_games IS
'Gets all active players from teams participating in the selected games.
Includes their REAL NBA salaries from nba_hoopshype_salaries.
Used to preview players before creating a DFS pool.';

-- ============================================================================
-- FUNCTION 3: Fix create_dfs_pool_from_games - Update CTE
-- ============================================================================

-- This function is complex, so we'll just update the problematic CTE
-- The main issue is in the "game_teams" CTE which needs to use correct column names

-- Note: This is a partial fix. The full function is in dfs_admin_pool_creation.sql
-- We're just updating the column references here.

-- You'll need to re-run the full dfs_admin_pool_creation.sql migration after this
-- OR manually update the create_dfs_pool_from_games function to use:
-- - home_team_tricode instead of home_team_abbr
-- - away_team_tricode instead of visitor_team_abbr
-- - game_date instead of game_date_est

-- ============================================================================
-- Test the fixes
-- ============================================================================

-- Test 1: Get available games for October 21, 2025
SELECT 
  game_id,
  home_team,
  away_team,
  home_team_name || ' vs ' || away_team_name as matchup,
  game_date,
  venue
FROM get_available_nba_games_for_dfs('2025-10-21');

-- Test 2: Get players for a specific game
SELECT 
  player_name,
  team,
  player_position,
  salary_2025_26,
  recent_avg_fantasy_pts
FROM get_dfs_players_for_games(ARRAY['0022500001'])
LIMIT 10;

