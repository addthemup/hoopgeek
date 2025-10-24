-- ============================================================================
-- MASTER FIX: All DFS Functions - Use Correct NBA Column Names
-- ============================================================================
-- Run this script in Supabase SQL Editor to fix all DFS functions at once
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: Get Available Games for DFS
-- ============================================================================

DROP FUNCTION IF EXISTS get_available_nba_games_for_dfs(DATE);

CREATE OR REPLACE FUNCTION get_available_nba_games_for_dfs(
  p_date DATE
)
RETURNS TABLE(
  game_id TEXT,
  game_date TIMESTAMPTZ,
  home_team TEXT,
  away_team TEXT,
  home_team_name TEXT,
  away_team_name TEXT,
  venue TEXT,
  game_status TEXT,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.game_id::TEXT,
    g.game_date,
    g.home_team_tricode::TEXT,
    g.away_team_tricode::TEXT,
    g.home_team_name::TEXT,
    g.away_team_name::TEXT,
    g.arena_name::TEXT as venue,
    g.game_status_text::TEXT as game_status,
    (g.game_status = 1) as is_available -- game_status 1 = scheduled/upcoming
  FROM nba_games g
  WHERE DATE(g.game_date) = p_date
    AND g.game_status = 1 -- Only upcoming games
  ORDER BY g.game_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 2: Get Players for Selected Games
-- ============================================================================

DROP FUNCTION IF EXISTS get_dfs_players_for_games(VARCHAR[]);

CREATE OR REPLACE FUNCTION get_dfs_players_for_games(
  p_game_ids VARCHAR(50)[]
)
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team TEXT,
  player_position TEXT,
  salary_2025_26 BIGINT,
  recent_avg_fantasy_pts DECIMAL,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team_tricode, away_team_tricode]) as team_abbr
    FROM nba_games
    WHERE game_id = ANY(p_game_ids)
  )
  SELECT 
    p.id,
    p.nba_player_id,
    p.name::TEXT,
    p.team_abbreviation::TEXT,
    p.position::TEXT,
    COALESCE(hs.salary_2025_26, 1157153::BIGINT) as salary_2025_26,
    35.0::DECIMAL as recent_avg_fantasy_pts,
    p.is_active
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE
  ORDER BY hs.salary_2025_26 DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 3: Create DFS Pool from Games (MAIN FUNCTION)
-- ============================================================================

DROP FUNCTION IF EXISTS create_dfs_pool_from_games(UUID, TEXT, TEXT, TEXT, DATE, VARCHAR[], DECIMAL, INTEGER, dfs_difficulty_tier, dfs_prize_type, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  p_admin_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids VARCHAR(50)[],
  p_entry_fee DECIMAL DEFAULT 0.00, -- Can be 0 for testing/free pools
  p_max_entries INTEGER DEFAULT 100,
  p_difficulty_tier dfs_difficulty_tier DEFAULT 'standard',
  p_prize_type dfs_prize_type DEFAULT 'top_n',
  p_is_guaranteed BOOLEAN DEFAULT FALSE,
  p_is_featured BOOLEAN DEFAULT FALSE
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
BEGIN
  -- Verify admin user
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = p_admin_user_id 
    AND is_active = TRUE
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Unauthorized: User is not an admin'::TEXT;
    RETURN;
  END IF;
  
  -- Validate we have games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Get lock time (earliest game start) and end time (latest game end)
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
  
  -- Create the pool
  INSERT INTO dfs_pools (
    name, description, slate_name, slate_date,
    start_time, lock_time, end_time,
    entry_fee, prize_pool, max_entries, salary_cap,
    difficulty_tier, prize_type,
    is_guaranteed, is_featured, is_public, status,
    created_by_admin_id
  ) VALUES (
    p_name, p_description, p_slate_name, p_slate_date,
    v_lock_time - INTERVAL '4 hours', v_lock_time, v_end_time,
    p_entry_fee, (p_entry_fee * p_max_entries * 0.9), p_max_entries, v_salary_cap,
    p_difficulty_tier, p_prize_type,
    p_is_guaranteed, p_is_featured, TRUE, 'scheduled',
    p_admin_user_id
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
  SELECT 
    v_pool_id, g.game_id::TEXT, g.game_date, g.home_team_tricode::TEXT, g.away_team_tricode::TEXT
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Auto-populate players from the selected games
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[dpg.home_team, dpg.away_team]) as team_abbr
    FROM dfs_pool_games dpg
    WHERE dpg.pool_id = v_pool_id
  )
  INSERT INTO dfs_player_salaries (
    pool_id, player_id, nba_player_id, player_name, player_team, player_position,
    salary, projected_points, is_active, is_playing
  )
  SELECT 
    v_pool_id, p.id, p.nba_player_id, p.name::TEXT, p.team_abbreviation::TEXT, p.position::TEXT,
    COALESCE(hs.salary_2025_26, 1157153) as salary,
    35.0 as projected_points,
    TRUE as is_active,
    TRUE as is_playing
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary statistics
  SELECT MIN(dps.salary), MAX(dps.salary)
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries dps
  WHERE dps.pool_id = v_pool_id;
  
  -- Log admin action (optional - only if audit_logs table exists)
  BEGIN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      p_admin_user_id, 'create', 'dfs_pool', v_pool_id,
      jsonb_build_object(
        'pool_name', p_name,
        'games_count', v_games_added,
        'players_count', v_players_added,
        'difficulty', p_difficulty_tier,
        'entry_fee', p_entry_fee
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Audit logs table doesn't exist yet, skip logging
      NULL;
  END;
  
  RETURN QUERY SELECT 
    v_pool_id, v_games_added, v_players_added, v_min_salary, v_max_salary, TRUE,
    format('Pool created successfully with %s games and %s players', v_games_added, v_players_added)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION TESTS
-- ============================================================================

-- Test 1: Should return 2 games for October 21, 2025
SELECT 
  'Test 1: Get games for 10/21/2025' as test_name,
  COUNT(*) as game_count,
  STRING_AGG(home_team || ' vs ' || away_team, ', ') as matchups
FROM get_available_nba_games_for_dfs('2025-10-21');

-- Test 2: Should return players for the HOU @ OKC game
SELECT 
  'Test 2: Get players for HOU @ OKC' as test_name,
  COUNT(*) as player_count
FROM get_dfs_players_for_games(ARRAY['0022500001']);

-- Done!
SELECT '✅ All DFS functions fixed! Entry fee can be $0 for testing. Try creating a pool now.' as status;

