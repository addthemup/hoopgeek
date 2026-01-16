-- ============================================================================
-- TEST TEAM OF THE NIGHT WITH A SPECIFIC DATE
-- Use this to test the function with a date that you know has games
-- ============================================================================

-- First, find a date that has games:
SELECT 
  game_date,
  COUNT(*) as boxscore_count,
  COUNT(DISTINCT nba_player_id) as unique_players
FROM nba_boxscores
WHERE game_date >= '2025-01-01'::DATE
GROUP BY game_date
ORDER BY game_date DESC
LIMIT 10;

-- Then test the function logic with that date by modifying the function temporarily
-- Or use this query to see what players would be selected for a specific date:

WITH test_date AS (
  SELECT '2025-11-10'::DATE as game_date  -- CHANGE THIS DATE to one that has games
),
player_performance AS (
  SELECT 
    p.id as player_id,
    p.nba_player_id,
    p.name as player_name,
    p.team_abbreviation::VARCHAR(10) as team,
    p."position"::VARCHAR(10) as player_position,
    COALESCE(p.jersey_number, '0')::TEXT as jersey_number,
    COALESCE(hs.salary_2025_26::BIGINT, 1157153) as salary,
    SUM(
      COALESCE(b.pts, 0) + 
      (COALESCE(b.reb, 0) * 1.2) + 
      (COALESCE(b.ast, 0) * 1.5) + 
      (COALESCE(b.stl, 0) * 3) + 
      (COALESCE(b.blk, 0) * 3) - 
      (COALESCE(b.tov, 0) * 1)
    ) as fantasy_points,
    COUNT(b.game_id)::INTEGER as games_played
  FROM nba_players p
  JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  CROSS JOIN test_date td
  WHERE b.game_date = td.game_date
    AND p.is_active = TRUE
    AND b.min > 0
    AND COALESCE(hs.salary_2025_26, 1157153) > 0
  GROUP BY 
    p.id, p.nba_player_id, p.name, p.team_abbreviation, 
    p."position", p.jersey_number, hs.salary_2025_26
  HAVING COUNT(b.game_id) >= 1
)
SELECT 
  COUNT(*) as total_eligible_players,
  SUM(salary) as total_salary_if_all_selected,
  AVG(fantasy_points) as avg_fantasy_points,
  MAX(fantasy_points) as max_fantasy_points,
  MIN(fantasy_points) as min_fantasy_points
FROM player_performance;

