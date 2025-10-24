-- ============================================================================
-- DEBUG: Team of the Week - Find Missing Games
-- ============================================================================

-- Step 1: Check what season_year values exist in nba_boxscores
SELECT DISTINCT season_year, COUNT(*) as game_count
FROM nba_boxscores
GROUP BY season_year
ORDER BY season_year DESC;

-- Step 2: Check Reed Sheppard's games specifically
SELECT 
  game_date,
  player_name,
  season_year,
  pts, reb, ast, stl, blk, tov, min,
  -- Calculate fantasy points
  (pts + (reb * 1.2) + (ast * 1.5) + (stl * 3) + (blk * 3) - tov) as fantasy_points
FROM nba_boxscores
WHERE player_name LIKE '%Reed%Sheppard%'
  OR player_name LIKE '%Sheppard%'
ORDER BY game_date DESC;

-- Step 3: Check all games in the preseason date range
SELECT 
  game_date,
  season_year,
  COUNT(*) as player_performances,
  COUNT(DISTINCT player_name) as unique_players
FROM nba_boxscores
WHERE game_date BETWEEN '2025-10-03' AND '2025-10-19'
GROUP BY game_date, season_year
ORDER BY game_date DESC;

-- Step 4: Test the actual query logic with Reed Sheppard
WITH previous_week_dates AS (
  SELECT 
    '2025-10-03'::DATE as prev_week_start,
    '2025-10-19'::DATE as prev_week_end
)
SELECT 
  p.name as player_name,
  p.nba_player_id,
  COUNT(b.game_id) as games_played,
  -- Show each game date
  STRING_AGG(b.game_date::TEXT, ', ' ORDER BY b.game_date) as game_dates,
  -- Calculate average fantasy points
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
CROSS JOIN previous_week_dates pwd
WHERE b.game_date BETWEEN pwd.prev_week_start AND pwd.prev_week_end
  AND p.is_active = TRUE
  AND b.min > 0
  AND p.name LIKE '%Sheppard%'
GROUP BY p.id, p.name, p.nba_player_id;

-- Step 5: Check if season_year filter is the problem
WITH previous_week_dates AS (
  SELECT 
    '2025-10-03'::DATE as prev_week_start,
    '2025-10-19'::DATE as prev_week_end
)
SELECT 
  p.name as player_name,
  b.season_year,
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
CROSS JOIN previous_week_dates pwd
WHERE b.game_date BETWEEN pwd.prev_week_start AND pwd.prev_week_end
  AND p.is_active = TRUE
  AND b.min > 0
  AND p.name LIKE '%Sheppard%'
GROUP BY p.id, p.name, b.season_year;

-- ============================================================================
-- INTERPRETATION:
-- 
-- Query 1: Shows what season_year values exist (2024-25, 2025-26, etc.)
-- Query 2: Shows ALL Reed Sheppard games in the database
-- Query 3: Shows games in preseason date range grouped by season_year
-- Query 4: Tests without season_year filter
-- Query 5: Tests with season_year to see if that's filtering out games
-- ============================================================================

