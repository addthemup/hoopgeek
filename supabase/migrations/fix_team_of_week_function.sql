-- ============================================================================
-- Fix get_dfs_team_of_week function to use correct season_year format
-- ============================================================================

-- Drop the old function first
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
    -- Get current NBA week date range (season_year is INTEGER, not STRING)
    SELECT 
      start_date,
      end_date
    FROM nba_season_weeks
    WHERE season_year = 2026  -- Changed from '2025-26' to 2026
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
    JOIN nba_boxscores b ON p.nba_player_id = b.player_id  -- Join on INTEGER = INTEGER
    LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
    CROSS JOIN current_week_dates cwd
    WHERE b.game_date BETWEEN cwd.start_date AND cwd.end_date
      AND p.is_active = TRUE
      AND b.min > 0 -- Player must have played
    GROUP BY 
      p.id, 
      p.nba_player_id, 
      p.name, 
      p.team_abbreviation, 
      p.position, 
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1 -- At least 1 game this week (changed from 2)
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dfs_team_of_week IS
'Gets top 5 performing players from current week for Team of the Week display.
Uses FanDuel scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
Requires nba_boxscores data and nba_season_weeks to determine current week.';

