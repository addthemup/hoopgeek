-- ============================================================================
-- QUICK FIX: Deploy DFS Fixes
-- Copy and paste this entire file into Supabase SQL Editor and click RUN
-- ============================================================================

-- Step 1: Add prize_won column to dfs_entries
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_entries
ADD COLUMN IF NOT EXISTS prize_won DECIMAL(10, 2) DEFAULT 0.00;

-- Copy existing prize_amount values to prize_won
UPDATE dfs_entries
SET prize_won = COALESCE(prize_amount, 0.00)
WHERE prize_won IS NULL OR prize_won = 0;

-- Create trigger to keep prize_won in sync with prize_amount
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

-- Step 2: Create get_dfs_team_of_week function
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
  WITH current_week_dates AS (
    -- Get current NBA week date range
    SELECT 
      start_date,
      end_date
    FROM nba_season_weeks
    WHERE season_year = 2026
      AND CURRENT_DATE BETWEEN start_date AND end_date
    LIMIT 1
  ),
  player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p.position::VARCHAR(10) as position,
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
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  )
  SELECT 
    pp.player_id,
    pp.nba_player_id,
    pp.player_name,
    pp.team,
    pp.position,
    pp.jersey_number,
    pp.salary,
    ROUND(pp.avg_fantasy_points, 1) as avg_fantasy_points,
    ROUND(pp.total_fantasy_points, 1) as total_fantasy_points,
    pp.games_played
  FROM player_performance pp
  ORDER BY pp.avg_fantasy_points DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO anon;

-- Verification query - Test the function
SELECT * FROM get_dfs_team_of_week();

-- ============================================================================
-- SUCCESS! 
-- If you see results above, the function is working.
-- If you see an error, check:
-- 1. Do you have data in nba_boxscores table?
-- 2. Do you have nba_season_weeks defined for season_year 2026?
-- ============================================================================

