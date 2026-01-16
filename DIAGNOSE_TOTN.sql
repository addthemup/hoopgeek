-- ============================================================================
-- DIAGNOSTIC QUERIES FOR TEAM OF THE NIGHT
-- Run these to check why get_optimal_lineup_of_the_night() returns no rows
-- ============================================================================

-- 1. Check what date the function is looking for
SELECT 
  (CURRENT_DATE - INTERVAL '1 day')::DATE as yesterday_date,
  CURRENT_DATE as today_date;

-- 2. Check if there are ANY games yesterday
SELECT 
  COUNT(*) as total_games_yesterday,
  COUNT(DISTINCT game_id) as unique_games,
  COUNT(DISTINCT nba_player_id) as unique_players
FROM nba_boxscores
WHERE game_date = (CURRENT_DATE - INTERVAL '1 day')::DATE;

-- 3. Check if there are active players with games yesterday
SELECT 
  COUNT(*) as active_players_with_games
FROM nba_players p
JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
WHERE b.game_date = (CURRENT_DATE - INTERVAL '1 day')::DATE
  AND p.is_active = TRUE
  AND b.min > 0;

-- 4. Check if there are players with salary data for yesterday
SELECT 
  COUNT(*) as players_with_salary_data
FROM nba_players p
JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
WHERE b.game_date = (CURRENT_DATE - INTERVAL '1 day')::DATE
  AND p.is_active = TRUE
  AND b.min > 0
  AND COALESCE(hs.salary_2025_26, 1157153) > 0;

-- 5. Show sample players from yesterday (if any exist)
SELECT 
  p.name,
  p.team_abbreviation,
  p."position",
  COALESCE(hs.salary_2025_26, 1157153) as salary,
  SUM(
    COALESCE(b.pts, 0) + 
    (COALESCE(b.reb, 0) * 1.2) + 
    (COALESCE(b.ast, 0) * 1.5) + 
    (COALESCE(b.stl, 0) * 3) + 
    (COALESCE(b.blk, 0) * 3) - 
    (COALESCE(b.tov, 0) * 1)
  ) as fantasy_points
FROM nba_players p
JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
WHERE b.game_date = (CURRENT_DATE - INTERVAL '1 day')::DATE
  AND p.is_active = TRUE
  AND b.min > 0
  AND COALESCE(hs.salary_2025_26, 1157153) > 0
GROUP BY p.id, p.name, p.team_abbreviation, p."position", hs.salary_2025_26
ORDER BY fantasy_points DESC
LIMIT 10;

-- 6. Check recent game dates to see what dates have data
SELECT 
  game_date,
  COUNT(*) as boxscore_count,
  COUNT(DISTINCT nba_player_id) as unique_players
FROM nba_boxscores
WHERE game_date >= (CURRENT_DATE - INTERVAL '7 days')::DATE
GROUP BY game_date
ORDER BY game_date DESC;

-- 7. Test the function directly
SELECT * FROM get_optimal_lineup_of_the_night();

