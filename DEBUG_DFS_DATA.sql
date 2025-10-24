-- ============================================================================
-- DEBUG: Check if required data exists for Team of the Week
-- Run this in Supabase SQL Editor to diagnose issues
-- ============================================================================

-- Check 1: Do we have the nba_season_weeks table?
-- ----------------------------------------------------------------------------
SELECT 
  'nba_season_weeks table' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'nba_season_weeks'
    ) 
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Check 2: Do we have season weeks defined for 2026?
-- ----------------------------------------------------------------------------
SELECT 
  'Season 2026 weeks' as check_name,
  COALESCE(COUNT(*)::TEXT, '0') || ' weeks defined' as status
FROM nba_season_weeks
WHERE season_year = 2026;

-- Check 3: What's the current week (if any)?
-- ----------------------------------------------------------------------------
SELECT 
  season_year,
  week_number,
  start_date,
  end_date,
  CASE 
    WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN '✅ CURRENT WEEK'
    ELSE 'Not current'
  END as is_current
FROM nba_season_weeks
WHERE season_year = 2026
ORDER BY week_number;

-- Check 4: Do we have boxscore data?
-- ----------------------------------------------------------------------------
SELECT 
  COUNT(*) as total_boxscores,
  COUNT(DISTINCT game_id) as unique_games,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game,
  COUNT(DISTINCT player_id) as unique_players
FROM nba_boxscores;

-- Check 5: Do we have boxscores in the current week?
-- ----------------------------------------------------------------------------
WITH current_week AS (
  SELECT start_date, end_date
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
)
SELECT 
  COUNT(*) as games_this_week,
  MIN(b.game_date) as earliest,
  MAX(b.game_date) as latest,
  COUNT(DISTINCT b.player_id) as players_who_played
FROM nba_boxscores b
CROSS JOIN current_week cw
WHERE b.game_date BETWEEN cw.start_date AND cw.end_date
  AND b.min > 0;

-- Check 6: Sample of top performers (if data exists)
-- ----------------------------------------------------------------------------
WITH current_week_dates AS (
  SELECT start_date, end_date
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
)
SELECT 
  p.name as player_name,
  p.team_abbreviation as team,
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
JOIN nba_boxscores b ON p.nba_player_id = b.player_id
CROSS JOIN current_week_dates cwd
WHERE b.game_date BETWEEN cwd.start_date AND cwd.end_date
  AND p.is_active = TRUE
  AND b.min > 0
GROUP BY p.id, p.name, p.team_abbreviation
ORDER BY avg_fantasy_points DESC
LIMIT 10;

-- ============================================================================
-- INTERPRETATION:
-- 
-- If Check 1 shows MISSING: You need to create nba_season_weeks table
-- If Check 2 shows 0 weeks: You need to insert season week data
-- If Check 3 shows no current week: You need to add week data for current date
-- If Check 4 shows 0 boxscores: You need to load game data
-- If Check 5 shows 0 games this week: The function will return empty (expected)
-- If Check 6 shows players: Great! Function should work
-- ============================================================================

