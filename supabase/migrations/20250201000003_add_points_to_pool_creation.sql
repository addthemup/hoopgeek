-- ============================================================================
-- Add Points Configuration to Pool Creation Function
-- ============================================================================
-- This migration updates create_dfs_pool_from_games to accept point
-- configuration parameters.

-- Drop ALL overloads of create_dfs_pool_from_games
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'create_dfs_pool_from_games' 
    AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- Recreate function with point parameters
CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  -- Required parameters
  p_pool_name TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids TEXT[],
  
  -- Optional basic parameters
  p_description TEXT DEFAULT NULL,
  p_entry_fee DECIMAL(10, 2) DEFAULT 0.00,
  p_max_entries INTEGER DEFAULT 1000,
  p_difficulty_tier dfs_difficulty_tier DEFAULT 'standard',
  
  -- Roster configuration
  p_starters_count INTEGER DEFAULT 5,
  p_rotation_count INTEGER DEFAULT 3,
  p_bench_count INTEGER DEFAULT 2,
  
  -- Scoring
  p_scoring_format TEXT DEFAULT 'FanDuel',
  
  -- Icon parameters
  p_icon_name TEXT DEFAULT NULL,
  p_html_color_primary TEXT DEFAULT NULL,
  p_html_color_secondary TEXT DEFAULT NULL,
  
  -- Lineup requirements
  p_lineup_requirements JSONB DEFAULT NULL,
  
  -- Point configuration
  p_points_entry INTEGER DEFAULT 10,
  p_points_win INTEGER DEFAULT 100,
  p_points_placement JSONB DEFAULT '[]'::jsonb,
  p_points_top_percent JSONB DEFAULT '[]'::jsonb,
  p_points_enabled BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  pool_id UUID,
  games_added INTEGER,
  players_added INTEGER,
  min_salary BIGINT,
  max_salary BIGINT,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_pool_id UUID;
  v_lock_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_start_time TIMESTAMPTZ;
  v_salary_cap BIGINT;
  v_games_added INTEGER := 0;
  v_players_added INTEGER := 0;
  v_min_salary BIGINT;
  v_max_salary BIGINT;
  v_prize_pool DECIMAL(12, 2);
BEGIN
  -- Validate games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Get lock time (earliest game start) and end time (latest game end)
  SELECT 
    MIN(game_date_est) as lock,
    MAX(game_date_est + INTERVAL '3 hours') as end_time
  INTO v_lock_time, v_end_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  IF v_lock_time IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No valid games found'::TEXT;
    RETURN;
  END IF;
  
  -- Set start time (4 hours before lock)
  v_start_time := v_lock_time - INTERVAL '4 hours';
  
  -- Set salary cap based on difficulty
  v_salary_cap := CASE p_difficulty_tier
    WHEN 'elite' THEN 154600000
    WHEN 'pro' THEN 195900000
    WHEN 'standard' THEN 207800000
    ELSE 207800000
  END;
  
  -- Calculate prize pool (90% of entry fees)
  v_prize_pool := (p_entry_fee * p_max_entries * 0.9);
  
  -- Create the pool
  INSERT INTO dfs_pools (
    name,
    description,
    slate_name,
    slate_date,
    start_time,
    lock_time,
    end_time,
    entry_fee,
    prize_pool,
    max_entries,
    salary_cap,
    difficulty_tier,
    prize_type,
    is_public,
    status,
    created_by_admin_id,
    -- Roster configuration
    roster_size,
    starters_count,
    rotation_count,
    bench_count,
    -- Scoring
    scoring_format,
    -- Icon
    icon_name,
    html_color_primary,
    html_color_secondary,
    -- Lineup requirements
    lineup_requirements,
    -- Point configuration
    points_entry,
    points_win,
    points_placement,
    points_top_percent,
    points_enabled
  ) VALUES (
    p_pool_name,
    p_description,
    p_slate_name,
    p_slate_date,
    v_start_time,
    v_lock_time,
    v_end_time,
    p_entry_fee,
    v_prize_pool,
    p_max_entries,
    v_salary_cap,
    p_difficulty_tier,
    'top_n',
    TRUE,
    'scheduled',
    auth.uid(),
    -- Roster
    p_starters_count + p_rotation_count + p_bench_count,
    p_starters_count,
    p_rotation_count,
    p_bench_count,
    -- Scoring
    p_scoring_format,
    -- Icon
    p_icon_name,
    p_html_color_primary,
    p_html_color_secondary,
    -- Lineup requirements
    p_lineup_requirements,
    -- Points
    p_points_entry,
    p_points_win,
    p_points_placement,
    p_points_top_percent,
    p_points_enabled
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
  SELECT 
    v_pool_id,
    g.game_id::TEXT,
    g.game_date_est,
    g.home_team_tricode::TEXT,
    g.away_team_tricode::TEXT
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Auto-populate players from the selected games
  INSERT INTO dfs_player_salaries (pool_id, player_id, nba_player_id, player_name, player_team, player_position, salary)
  SELECT DISTINCT
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.player_name,
    p.team_abbreviation,
    p.position,
    COALESCE(ps.salary, 0)
  FROM nba_players p
  LEFT JOIN player_salaries ps ON p.nba_player_id = ps.nba_player_id
  WHERE p.team_abbreviation IN (
    SELECT DISTINCT home_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
    UNION
    SELECT DISTINCT away_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
  )
  AND p.is_active = TRUE
  ON CONFLICT (pool_id, player_id) DO NOTHING;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary range
  SELECT 
    MIN(salary),
    MAX(salary)
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries
  WHERE pool_id = v_pool_id;
  
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    COALESCE(v_min_salary, 0::BIGINT),
    COALESCE(v_max_salary, 0::BIGINT),
    TRUE,
    'Pool created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_dfs_pool_from_games TO authenticated, service_role;

COMMENT ON FUNCTION create_dfs_pool_from_games IS 
'Creates a DFS pool from selected NBA games with point configuration support';

