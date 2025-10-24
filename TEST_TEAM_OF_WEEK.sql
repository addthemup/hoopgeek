-- ============================================================================
-- TEST TEAM OF THE WEEK API
-- Run these queries in Supabase SQL Editor to test the function
-- ============================================================================

-- =============================================================================
-- QUERY 1: Test the function directly (this is what your frontend calls)
-- =============================================================================
SELECT * FROM get_dfs_team_of_week();

-- Expected columns:
-- - player_id (UUID)
-- - nba_player_id (INTEGER)
-- - player_name (TEXT)
-- - team (VARCHAR)
-- - player_position (VARCHAR)
-- - jersey_number (TEXT)
-- - salary (BIGINT)
-- - avg_fantasy_points (DECIMAL)
-- - total_fantasy_points (DECIMAL)
-- - games_played (INTEGER)


-- =============================================================================
-- QUERY 2: Check if we have season weeks data for 2026
-- =============================================================================
SELECT 
  season_year,
  week_number,
  start_date,
  end_date,
  CASE 
    WHEN CURRENT_DATE BETWEEN start_date AND end_date 
    THEN '✅ CURRENT WEEK' 
    ELSE '❌ Not current'
  END as is_current_week
FROM nba_season_weeks
WHERE season_year = 2026
ORDER BY week_number;


-- =============================================================================
-- QUERY 3: Check boxscore data availability
-- =============================================================================
SELECT 
  COUNT(*) as total_boxscores,
  COUNT(DISTINCT game_id) as total_games,
  COUNT(DISTINCT nba_player_id) as total_players,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game
FROM nba_boxscores;


-- =============================================================================
-- QUERY 4: Check if we have boxscores for the current week
-- =============================================================================
WITH current_week AS (
  SELECT start_date, end_date
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
)
SELECT 
  COUNT(*) as games_in_current_week,
  COUNT(DISTINCT b.nba_player_id) as players_who_played,
  MIN(b.game_date) as first_game,
  MAX(b.game_date) as last_game
FROM nba_boxscores b
CROSS JOIN current_week cw
WHERE b.game_date BETWEEN cw.start_date AND cw.end_date
  AND b.min > 0;


-- =============================================================================
-- QUERY 5: See top 10 performers this week (manual calculation)
-- =============================================================================
WITH current_week_dates AS (
  SELECT start_date, end_date
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
)
SELECT 
  p.nba_player_id,
  p.name as player_name,
  p.team_abbreviation,
  p.position,
  COUNT(b.game_id) as games_played,
  
  -- FanDuel scoring breakdown
  ROUND(AVG(b.pts), 1) as avg_pts,
  ROUND(AVG(b.reb), 1) as avg_reb,
  ROUND(AVG(b.ast), 1) as avg_ast,
  ROUND(AVG(b.stl), 1) as avg_stl,
  ROUND(AVG(b.blk), 1) as avg_blk,
  ROUND(AVG(b.tov), 1) as avg_tov,
  
  -- Fantasy points calculation
  ROUND(AVG(
    COALESCE(b.pts, 0) + 
    (COALESCE(b.reb, 0) * 1.2) + 
    (COALESCE(b.ast, 0) * 1.5) + 
    (COALESCE(b.stl, 0) * 3) + 
    (COALESCE(b.blk, 0) * 3) - 
    (COALESCE(b.tov, 0) * 1)
  ), 1) as avg_fantasy_points,
  
  COALESCE(hs.salary_2025_26, 1157153) as salary
FROM nba_players p
JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
CROSS JOIN current_week_dates cwd
WHERE b.game_date BETWEEN cwd.start_date AND cwd.end_date
  AND p.is_active = TRUE
  AND b.min > 0
GROUP BY 
  p.id,
  p.nba_player_id, 
  p.name, 
  p.team_abbreviation, 
  p.position,
  hs.salary_2025_26
HAVING COUNT(b.game_id) >= 1
ORDER BY avg_fantasy_points DESC
LIMIT 10;


-- =============================================================================
-- QUERY 6: Check if specific date range has data (last 7 days)
-- =============================================================================
SELECT 
  game_date,
  COUNT(*) as player_performances,
  COUNT(DISTINCT game_id) as games,
  COUNT(DISTINCT nba_player_id) as unique_players
FROM nba_boxscores
WHERE game_date >= CURRENT_DATE - INTERVAL '7 days'
  AND game_date <= CURRENT_DATE
  AND min > 0
GROUP BY game_date
ORDER BY game_date DESC;


-- =============================================================================
-- QUERY 7: Test with a specific date range (last week)
-- =============================================================================
WITH last_week AS (
  SELECT 
    (CURRENT_DATE - INTERVAL '7 days')::DATE as start_date,
    CURRENT_DATE::DATE as end_date
)
SELECT 
  p.name as player_name,
  p.team_abbreviation,
  p.position,
  COUNT(b.game_id) as games_played,
  ROUND(AVG(
    COALESCE(b.pts, 0) + 
    (COALESCE(b.reb, 0) * 1.2) + 
    (COALESCE(b.ast, 0) * 1.5) + 
    (COALESCE(b.stl, 0) * 3) + 
    (COALESCE(b.blk, 0) * 3) - 
    (COALESCE(b.tov, 0) * 1)
  ), 1) as avg_fantasy_points
FROM nba_players p
JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
CROSS JOIN last_week lw
WHERE b.game_date BETWEEN lw.start_date AND lw.end_date
  AND p.is_active = TRUE
  AND b.min > 0
GROUP BY p.id, p.name, p.team_abbreviation, p.position
HAVING COUNT(b.game_id) >= 1
ORDER BY avg_fantasy_points DESC
LIMIT 10;


-- =============================================================================
-- INTERPRETATION GUIDE
-- =============================================================================
-- 
-- Query 1: Main function test
--   - If returns data: SUCCESS! ✅
--   - If returns empty: No data for current week (check Query 2-4)
--   - If errors: Check the error message
--
-- Query 2: Season weeks check
--   - Should show weeks for season 2026
--   - Look for "✅ CURRENT WEEK" in is_current_week column
--   - If no current week: Function will return empty
--
-- Query 3: Overall boxscore data
--   - Shows if you have ANY game data
--   - If total_boxscores = 0: No game data loaded
--
-- Query 4: Current week boxscores
--   - Shows data specifically for the current NBA week
--   - If games_in_current_week = 0: No games this week yet
--
-- Query 5: Manual top performers
--   - Shows what the function SHOULD return
--   - Good for debugging the calculation
--
-- Query 6: Recent games check
--   - Shows games from last 7 days
--   - Helps verify if data is being loaded
--
-- Query 7: Fallback query (last 7 days)
--   - Alternative calculation using last week instead of NBA week
--   - Useful if nba_season_weeks isn't set up
--
-- =============================================================================

