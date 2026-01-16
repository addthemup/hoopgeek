-- Fix get_dfs_team_of_week function
-- Issues fixed:
-- 1. Join on nba_boxscores uses b.player_id (UUID) instead of b.nba_player_id (INTEGER)
-- 2. Column name mismatch: function returns player_position but selects position

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
  WITH last_week_dates AS (
    -- Get LAST week's completed date range (most recent fully completed week)
    SELECT 
      start_date,
      end_date
    FROM nba_season_weeks
    WHERE season_year = 2026
      AND end_date < CURRENT_DATE  -- Week has already ended
    ORDER BY end_date DESC
    LIMIT 1
  ),
  player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p.position::VARCHAR(10) as player_position,
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
    -- FIX: Join on nba_player_id (INTEGER) instead of player_id (UUID)
    JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
    LEFT JOIN nba_hoopshype_salaries hs ON p.nba_player_id = hs.player_id
    CROSS JOIN last_week_dates lwd
    WHERE b.game_date BETWEEN lwd.start_date AND lwd.end_date
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
    pp.player_position,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO anon;

COMMENT ON FUNCTION get_dfs_team_of_week IS
'Gets top 5 performing players from LAST WEEK (most recently completed week) for Team of the Week display.
Uses FanDuel scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
Shows completed weeks only, not the current in-progress week.
Fixed to join nba_boxscores on nba_player_id (INTEGER) instead of player_id (UUID).';

