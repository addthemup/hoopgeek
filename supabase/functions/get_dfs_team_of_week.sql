-- Function to get Team of the Week
-- Returns top 5 players (2G, 2F, 1C) based on average fantasy points from the previous week

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_dfs_team_of_week();

CREATE OR REPLACE FUNCTION get_dfs_team_of_week()
RETURNS TABLE (
  player_id uuid,
  nba_player_id integer,
  player_name text,
  team text,
  "position" text,
  jersey_number text,
  salary bigint,
  avg_fantasy_points numeric,
  games_played bigint
) 
LANGUAGE plpgsql
AS $$
DECLARE
  current_week_start date;
  current_week_end date;
  previous_week_start date;
  previous_week_end date;
  current_season_year integer;
BEGIN
  -- Get the current week information
  SELECT 
    w.start_date,
    w.end_date,
    w.season_year
  INTO 
    current_week_start,
    current_week_end,
    current_season_year
  FROM weeks w
  WHERE w.start_date <= CURRENT_DATE 
    AND w.end_date >= CURRENT_DATE
    AND w.league_id = 0  -- Global weeks
  ORDER BY w.start_date DESC
  LIMIT 1;

  -- If we can't find current week, use a default
  IF current_week_start IS NULL THEN
    current_week_start := CURRENT_DATE;
    current_week_end := CURRENT_DATE;
    current_season_year := EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;

  -- Get the previous week (for Team of the Week data)
  -- This will typically be the preseason if we're in Week 1
  SELECT 
    w.start_date,
    w.end_date
  INTO 
    previous_week_start,
    previous_week_end
  FROM weeks w
  WHERE w.end_date < current_week_start
    AND w.season_year = current_season_year
    AND w.league_id = 0  -- Global weeks
  ORDER BY w.end_date DESC
  LIMIT 1;

  -- If no previous week found, use last 7 days
  IF previous_week_start IS NULL THEN
    previous_week_start := CURRENT_DATE - INTERVAL '7 days';
    previous_week_end := CURRENT_DATE - INTERVAL '1 day';
  END IF;

  -- Calculate fantasy points and get top players by position
  RETURN QUERY
  WITH player_stats AS (
    SELECT 
      nb.nba_player_id,
      nb.player_name,
      nb.team_abbreviation as team,
      nb."position" as "position",
      nb.jersey_num::text as jersey_number,
      -- Calculate FanDuel fantasy points for each game
      (
        (COALESCE(nb.pts, 0) * 1.0) +
        (COALESCE(nb.reb, 0) * 1.2) +
        (COALESCE(nb.ast, 0) * 1.5) +
        (COALESCE(nb.stl, 0) * 2.0) +
        (COALESCE(nb.blk, 0) * 2.0) +
        (COALESCE(nb.tov, 0) * -1.0)
      ) as fantasy_points,
      COUNT(*) OVER (PARTITION BY nb.nba_player_id) as games_played_count
    FROM nba_boxscores nb
    WHERE nb.game_date::date >= previous_week_start
      AND nb.game_date::date <= previous_week_end
      AND nb.min > 0  -- Only players who played
  ),
  player_averages AS (
    SELECT 
      ps.nba_player_id,
      ps.player_name,
      ps.team,
      ps."position",
      ps.jersey_number,
      AVG(ps.fantasy_points) as avg_fp,
      MAX(ps.games_played_count) as games_played
    FROM player_stats ps
    GROUP BY 
      ps.nba_player_id,
      ps.player_name,
      ps.team,
      ps."position",
      ps.jersey_number
    HAVING COUNT(*) >= 1  -- At least 1 game played
  ),
  position_groups AS (
    SELECT 
      pa.*,
      CASE 
        -- Map positions to simplified categories
        WHEN pa."position" IN ('PG', 'SG', 'G') THEN 'G'
        WHEN pa."position" IN ('SF', 'PF', 'F') THEN 'F'
        WHEN pa."position" IN ('C') THEN 'C'
        -- Handle multi-position players
        WHEN pa."position" LIKE '%G%' THEN 'G'
        WHEN pa."position" LIKE '%F%' AND pa."position" NOT LIKE '%G%' THEN 'F'
        WHEN pa."position" LIKE '%C%' THEN 'C'
        ELSE 'F'  -- Default to forward if unclear
      END as position_group,
      ROW_NUMBER() OVER (
        PARTITION BY CASE 
          WHEN pa."position" IN ('PG', 'SG', 'G') THEN 'G'
          WHEN pa."position" IN ('SF', 'PF', 'F') THEN 'F'
          WHEN pa."position" IN ('C') THEN 'C'
          WHEN pa."position" LIKE '%G%' THEN 'G'
          WHEN pa."position" LIKE '%F%' AND pa."position" NOT LIKE '%G%' THEN 'F'
          WHEN pa."position" LIKE '%C%' THEN 'C'
          ELSE 'F'
        END
        ORDER BY pa.avg_fp DESC
      ) as position_rank
    FROM player_averages pa
  ),
  top_players AS (
    -- Get top 2 guards
    (SELECT * FROM position_groups WHERE position_group = 'G' AND position_rank <= 2)
    UNION ALL
    -- Get top 2 forwards
    (SELECT * FROM position_groups WHERE position_group = 'F' AND position_rank <= 2)
    UNION ALL
    -- Get top 1 center
    (SELECT * FROM position_groups WHERE position_group = 'C' AND position_rank <= 1)
  )
  SELECT 
    NULL::uuid as player_id,  -- We don't have a player_id in boxscores, could join with players table if needed
    tp.nba_player_id,
    tp.player_name,
    tp.team,
    tp."position",
    tp.jersey_number,
    COALESCE(p.salary, 0) as salary,  -- Get salary from players table
    ROUND(tp.avg_fp::numeric, 1) as avg_fantasy_points,
    tp.games_played
  FROM top_players tp
  LEFT JOIN players p ON p.nba_player_id = tp.nba_player_id
  ORDER BY tp.position_group, tp.position_rank;
END;
$$;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO anon;
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dfs_team_of_week() TO service_role;

-- Add comment
COMMENT ON FUNCTION get_dfs_team_of_week() IS 'Returns top 5 players (2G, 2F, 1C) based on average fantasy points from previous week using FanDuel scoring';

-- Verify function was created
DO $$ 
BEGIN
  RAISE NOTICE 'Function get_dfs_team_of_week() created successfully!';
  RAISE NOTICE 'Test it with: SELECT * FROM get_dfs_team_of_week();';
END $$;

