-- Fix DFS Pool Creation to Accept TEXT for ENUMs and Cast Them
-- This allows the frontend to pass plain strings that get cast to ENUM types

-- Drop ALL overloads of create_dfs_pool_from_games
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        INNER JOIN pg_namespace ns ON (pg_proc.pronamespace = ns.oid)
        WHERE proname = 'create_dfs_pool_from_games' 
        AND ns.nspname = 'public'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.create_dfs_pool_from_games(' || r.argtypes || ') CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  -- Required parameters first (no defaults)
  p_pool_name TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids VARCHAR(50)[],
  -- Optional parameters last (with defaults)
  p_description TEXT DEFAULT '',
  p_entry_fee DECIMAL DEFAULT 10.00,
  p_max_entries INTEGER DEFAULT 100,
  p_difficulty_tier TEXT DEFAULT 'standard',
  p_starters_count INTEGER DEFAULT 5,
  p_rotation_count INTEGER DEFAULT 3,
  p_bench_count INTEGER DEFAULT 2,
  p_scoring_format TEXT DEFAULT 'FanDuel'
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
  v_games_added INTEGER := 0;
  v_players_added INTEGER := 0;
  v_min_salary BIGINT;
  v_max_salary BIGINT;
  v_salary_cap BIGINT;
  v_roster_size INTEGER;
  v_admin_user_id UUID;
BEGIN
  -- Get current user ID from auth
  v_admin_user_id := auth.uid();
  
  -- Verify admin user
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_user_id 
    AND is_active = TRUE
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Unauthorized: User is not an admin'::TEXT;
    RETURN;
  END IF;
  
  -- Validate games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate roster size
  v_roster_size := p_starters_count + p_rotation_count + p_bench_count;
  
  -- Get lock time and end time
  SELECT 
    MIN(game_date) as lock,
    MAX(game_date + INTERVAL '3 hours') as end_time
  INTO v_lock_time, v_end_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  -- Set salary cap based on difficulty
  v_salary_cap := CASE p_difficulty_tier
    WHEN 'elite' THEN 154600000
    WHEN 'pro' THEN 195900000
    WHEN 'standard' THEN 207800000
    ELSE 207800000
  END;
  
  -- Create the pool with explicit ENUM casts
  INSERT INTO dfs_pools (
    name, description, slate_name, slate_date,
    start_time, lock_time, end_time,
    entry_fee, prize_pool, max_entries, salary_cap,
    difficulty_tier, prize_type, scoring_format,
    is_guaranteed, is_featured, is_public, status,
    created_by_admin_id,
    roster_size, starters_count, rotation_count, bench_count,
    starters_multiplier, rotation_multiplier, bench_multiplier
  ) VALUES (
    p_pool_name, p_description, p_slate_name, p_slate_date,
    v_lock_time - INTERVAL '4 hours', v_lock_time, v_end_time,
    p_entry_fee, (p_entry_fee * p_max_entries * 0.9), p_max_entries, v_salary_cap,
    p_difficulty_tier::dfs_difficulty_tier,  -- Cast TEXT to ENUM
    'top_n'::dfs_prize_type,                 -- Default prize type
    p_scoring_format,
    FALSE, FALSE, TRUE, 'scheduled',         -- Default: not guaranteed, not featured
    v_admin_user_id,
    v_roster_size, p_starters_count, p_rotation_count, p_bench_count,
    1.00, 0.75, 0.50
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
  SELECT 
    v_pool_id, g.game_id, g.game_date, g.home_team_tricode, g.away_team_tricode
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Get salary ranges for players
  SELECT 
    MIN(COALESCE(s.salary_2025_26, 5000000)),
    MAX(COALESCE(s.salary_2025_26, 100000000))
  INTO v_min_salary, v_max_salary
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries s ON p.id = s.player_id
  WHERE p.is_active = TRUE;
  
  -- Add players to the pool
  INSERT INTO dfs_player_salaries (
    pool_id, player_id, nba_player_id, player_name, player_team, player_position, salary
  )
  SELECT 
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    COALESCE(s.salary_2025_26, 5000000) as salary
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries s ON p.id = s.player_id
  WHERE p.is_active = TRUE
  AND p.team_abbreviation IN (
    SELECT DISTINCT home_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
    UNION
    SELECT DISTINCT away_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
  );
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    v_min_salary,
    v_max_salary,
    TRUE,
    'Pool created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_dfs_pool_from_games TO service_role;

