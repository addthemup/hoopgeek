-- ============================================================================
-- DFS TEAM OF THE WEEK - DYNAMIC VERSION (No nba_season_weeks required)
-- Automatically calculates previous week based on actual game dates
-- ============================================================================

-- Step 1: Add prize_won column to dfs_entries
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_entries
ADD COLUMN IF NOT EXISTS prize_won DECIMAL(10, 2) DEFAULT 0.00;

UPDATE dfs_entries
SET prize_won = COALESCE(prize_amount, 0.00)
WHERE prize_won IS NULL OR prize_won = 0;

CREATE OR REPLACE FUNCTION sync_prize_won()
RETURNS TRIGGER AS $$
BEGIN
  NEW.prize_won := NEW.prize_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_prize_won ON dfs_entries;
CREATE TRIGGER trigger_sync_prize_won
  BEFORE INSERT OR UPDATE OF prize_amount ON dfs_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_prize_won();

-- Step 2: Create dynamic get_dfs_team_of_week function
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_dfs_team_of_week();

CREATE OR REPLACE FUNCTION get_dfs_team_of_week()
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  jersey_number TEXT,
  salary BIGINT,
  avg_fantasy_points DECIMAL,
  total_fantasy_points DECIMAL,
  games_played INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH current_week_info AS (
    -- Find which week we're currently in
    SELECT 
      week_number,
      start_date,
      end_date
    FROM nba_season_weeks
    WHERE season_year = 2026
      AND CURRENT_DATE BETWEEN start_date AND end_date
    LIMIT 1
  ),
  previous_week_dates AS (
    -- Get the PREVIOUS week's date range
    SELECT 
      nsw.start_date as prev_week_start,
      nsw.end_date as prev_week_end,
      nsw.week_number as prev_week_number,
      nsw.week_name as prev_week_name
    FROM nba_season_weeks nsw
    CROSS JOIN current_week_info cwi
    WHERE nsw.season_year = 2026
      AND nsw.week_number = (cwi.week_number - 1)
    LIMIT 1
  ),
  player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p."position"::VARCHAR(10) as player_position,
      COALESCE(p.jersey_number, '0')::TEXT as jersey_number,
      COALESCE(hs.salary_2025_26, 1157153) as salary,
      
      -- Calculate fantasy points (FanDuel scoring)
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_points,
      
      SUM(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as total_fantasy_points,
      
      COUNT(b.game_id)::INTEGER as games_played
      
    FROM nba_players p
    JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
    LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
    CROSS JOIN previous_week_dates pwd
    WHERE b.game_date BETWEEN pwd.prev_week_start AND pwd.prev_week_end
      AND p.is_active = TRUE
      AND b.min > 0
      -- Removed season_year filter to get ALL games in date range
    GROUP BY 
      p.id, 
      p.nba_player_id, 
      p.name, 
      p.team_abbreviation, 
      p."position", 
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  -- Select top 2 guards
  top_guards AS (
    SELECT 
      pp.player_id,
      pp.nba_player_id,
      pp.player_name,
      pp.team,
      pp.player_position,
      pp.jersey_number,
      pp.salary,
      ROUND(pp.avg_fantasy_points, 1) as avg_fantasy_points,
      ROUND(pp.total_fantasy_points, 1) as total_fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Guard%' 
      OR pp.player_position IN ('PG', 'SG', 'G')
    ORDER BY pp.avg_fantasy_points DESC
    LIMIT 2
  ),
  -- Select top 2 forwards
  top_forwards AS (
    SELECT 
      pp.player_id,
      pp.nba_player_id,
      pp.player_name,
      pp.team,
      pp.player_position,
      pp.jersey_number,
      pp.salary,
      ROUND(pp.avg_fantasy_points, 1) as avg_fantasy_points,
      ROUND(pp.total_fantasy_points, 1) as total_fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Forward%' 
      OR pp.player_position IN ('SF', 'PF', 'F')
    ORDER BY pp.avg_fantasy_points DESC
    LIMIT 2
  ),
  -- Select top center
  top_center AS (
    SELECT 
      pp.player_id,
      pp.nba_player_id,
      pp.player_name,
      pp.team,
      pp.player_position,
      pp.jersey_number,
      pp.salary,
      ROUND(pp.avg_fantasy_points, 1) as avg_fantasy_points,
      ROUND(pp.total_fantasy_points, 1) as total_fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Center%' 
      OR pp.player_position = 'C'
    ORDER BY pp.avg_fantasy_points DESC
    LIMIT 1
  )
  -- Combine all positions
  SELECT * FROM top_guards
  UNION ALL
  SELECT * FROM top_forwards
  UNION ALL
  SELECT * FROM top_center
  ORDER BY avg_fantasy_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO anon;

-- Test the function
SELECT * FROM get_dfs_team_of_week();

-- Show debug info (what week range was used)
WITH current_week_info AS (
  SELECT 
    week_number,
    week_name,
    start_date,
    end_date
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1
),
previous_week_info AS (
  SELECT 
    nsw.week_number,
    nsw.week_name,
    nsw.start_date,
    nsw.end_date
  FROM nba_season_weeks nsw
  CROSS JOIN current_week_info cwi
  WHERE nsw.season_year = 2026
    AND nsw.week_number = (cwi.week_number - 1)
  LIMIT 1
)
SELECT 
  CURRENT_DATE as today,
  cwi.week_name as current_week,
  cwi.start_date as current_week_start,
  cwi.end_date as current_week_end,
  pwi.week_name as previous_week,
  pwi.start_date as previous_week_start,
  pwi.end_date as previous_week_end
FROM current_week_info cwi
CROSS JOIN previous_week_info pwi;

-- ============================================================================
-- EXPLANATION:
-- This function:
-- 1. Finds the current week from nba_season_weeks (where today falls)
-- 2. Gets the PREVIOUS week's date range (week_number - 1)
-- 3. Returns top 5 performers from that previous week
-- 
-- Example:
--   Today: Oct 22, 2025 → Current Week: Week 1 (Oct 21-26)
--   Previous Week: Week 0 "Preseason" (Oct 3-19)
--   Returns: Top 5 performers from Oct 3-19
-- ============================================================================

