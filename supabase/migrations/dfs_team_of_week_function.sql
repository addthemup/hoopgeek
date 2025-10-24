-- ============================================================================
-- DFS TEAM OF THE WEEK FUNCTION
-- ============================================================================
-- Purpose: Get top 5 performing players from current week for display
-- ============================================================================

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
    WHERE season_year = '2025-26'
      AND week_number = (
        SELECT week_number 
        FROM nba_season_weeks 
        WHERE season_year = '2025-26'
          AND CURRENT_DATE BETWEEN start_date AND end_date
        LIMIT 1
      )
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
      
      -- Calculate fantasy points
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
      AND b.min > 0 -- Player must have played
    GROUP BY 
      p.id, 
      p.nba_player_id, 
      p.name, 
      p.team_abbreviation, 
      p.position, 
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 2 -- At least 2 games this week
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
'Returns top 5 performing players from current NBA week based on fantasy points.
Used for "Team of the Week" display on DFS homepage.
Requires at least 2 games played in the current week.';

-- ============================================================================
-- FUNCTION: Get DFS Weekly Leaders by Position
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dfs_weekly_leaders_by_position(
  p_position VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  jersey_number TEXT,
  salary BIGINT,
  avg_fantasy_points DECIMAL,
  games_played INTEGER,
  rank_in_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH current_week_dates AS (
    SELECT 
      start_date,
      end_date
    FROM nba_season_weeks
    WHERE season_year = '2025-26'
      AND week_number = (
        SELECT week_number 
        FROM nba_season_weeks 
        WHERE season_year = '2025-26'
          AND CURRENT_DATE BETWEEN start_date AND end_date
        LIMIT 1
      )
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
      
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_points,
      
      COUNT(b.game_id)::INTEGER as games_played,
      
      ROW_NUMBER() OVER (
        PARTITION BY p.position 
        ORDER BY AVG(
          COALESCE(b.pts, 0) + 
          (COALESCE(b.reb, 0) * 1.2) + 
          (COALESCE(b.ast, 0) * 1.5) + 
          (COALESCE(b.stl, 0) * 3) + 
          (COALESCE(b.blk, 0) * 3) - 
          (COALESCE(b.tov, 0) * 1)
        ) DESC
      ) as rank_in_position
      
    FROM nba_players p
    JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
    LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
    CROSS JOIN current_week_dates cwd
    WHERE b.game_date BETWEEN cwd.start_date AND cwd.end_date
      AND p.is_active = TRUE
      AND b.min > 0
      AND (p_position IS NULL OR p.position = p_position)
    GROUP BY 
      p.id, 
      p.nba_player_id, 
      p.name, 
      p.team_abbreviation, 
      p.position, 
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 2
  )
  SELECT 
    pp.player_id,
    pp.nba_player_id,
    pp.player_name,
    pp.team,
    pp.position,
    pp.jersey_number::TEXT,
    pp.salary,
    ROUND(pp.avg_fantasy_points, 1) as avg_fantasy_points,
    pp.games_played,
    pp.rank_in_position::INTEGER
  FROM player_performance pp
  WHERE pp.rank_in_position <= 10 -- Top 10 per position
  ORDER BY pp.position, pp.rank_in_position;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dfs_weekly_leaders_by_position IS
'Returns top 10 players per position for current week.
Can filter by specific position or get all positions.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_dfs_team_of_week TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_dfs_weekly_leaders_by_position TO anon, authenticated;

-- ============================================================================
-- SAMPLE USAGE
-- ============================================================================

/*

-- Get team of the week
SELECT * FROM get_dfs_team_of_week();

-- Result:
-- player_id | player_name    | team | position | salary      | avg_fantasy_points | games_played
-- --------- | -------------- | ---- | -------- | ----------- | ------------------ | ------------
-- xxx       | Stephen Curry  | GSW  | PG       | 51,915,615  | 52.3               | 3
-- xxx       | Joel Embiid    | PHI  | C        | 47,607,350  | 51.2               | 2
-- ...


-- Get top guards this week
SELECT * FROM get_dfs_weekly_leaders_by_position('G');

-- Get all positions
SELECT * FROM get_dfs_weekly_leaders_by_position();

*/

-- ============================================================================
-- END
-- ============================================================================

