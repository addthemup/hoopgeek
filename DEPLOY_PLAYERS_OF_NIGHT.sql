-- ============================================================================
-- PLAYERS OF THE NIGHT - Last Night's Top Performers
-- Returns top 5 players from yesterday's games (2G, 2F, 1C)
-- ============================================================================

DROP FUNCTION IF EXISTS get_players_of_the_night();

CREATE OR REPLACE FUNCTION get_players_of_the_night()
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  jersey_number TEXT,
  salary BIGINT,
  fantasy_points DECIMAL,
  games_played INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH last_night_games AS (
    -- Get yesterday's date
    SELECT 
      (CURRENT_DATE - INTERVAL '1 day')::DATE as game_date
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
    CROSS JOIN last_night_games lng
    WHERE b.game_date = lng.game_date
      AND p.is_active = TRUE
      AND b.min > 0
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
      ROUND(pp.fantasy_points, 1) as fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Guard%' 
      OR pp.player_position IN ('PG', 'SG', 'G')
    ORDER BY pp.fantasy_points DESC
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
      ROUND(pp.fantasy_points, 1) as fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Forward%' 
      OR pp.player_position IN ('SF', 'PF', 'F')
    ORDER BY pp.fantasy_points DESC
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
      ROUND(pp.fantasy_points, 1) as fantasy_points,
      pp.games_played
    FROM player_performance pp
    WHERE pp.player_position ILIKE '%Center%' 
      OR pp.player_position = 'C'
    ORDER BY pp.fantasy_points DESC
    LIMIT 1
  )
  -- Combine all positions
  SELECT * FROM top_guards
  UNION ALL
  SELECT * FROM top_forwards
  UNION ALL
  SELECT * FROM top_center
  ORDER BY fantasy_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_players_of_the_night() TO authenticated;
GRANT EXECUTE ON FUNCTION get_players_of_the_night() TO anon;

-- Test the function
SELECT * FROM get_players_of_the_night();

-- Show what date it's checking
SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE as yesterday;

-- ============================================================================
-- EXPLANATION:
-- This function returns top 5 players from YESTERDAY's games
-- If no games yesterday, returns empty (component won't show)
-- Uses same FanDuel scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
-- ============================================================================

