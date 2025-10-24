-- ============================================================================
-- FIX: create_dfs_pool_from_games - Use Correct Column Names
-- ============================================================================
-- Update all references to use the new NBA CDN column names
-- ============================================================================

DROP FUNCTION IF EXISTS create_dfs_pool_from_games(UUID, TEXT, TEXT, TEXT, DATE, VARCHAR[], DECIMAL, INTEGER, dfs_difficulty_tier, dfs_prize_type, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  p_admin_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids VARCHAR(50)[],
  p_entry_fee DECIMAL DEFAULT 10.00,
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
  -- Verify admin user (check against admin_users table)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = p_admin_user_id 
    AND is_active = TRUE
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      0,
      0,
      0::BIGINT,
      0::BIGINT,
      FALSE,
      'Unauthorized: User is not an admin'::TEXT;
    RETURN;
  END IF;
  
  -- Validate we have games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      0,
      0,
      0::BIGINT,
      0::BIGINT,
      FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Get lock time (earliest game start) and end time (latest game end)
  -- FIXED: Use game_date instead of game_date_est
  SELECT 
    MIN(game_date) as lock,
    MAX(game_date + INTERVAL '3 hours') as end_time -- Assume 3hr games
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
  
  -- Calculate prize pool (simple 90% payout for now)
  
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
    is_guaranteed,
    is_featured,
    is_public,
    status,
    created_by_admin_id
  ) VALUES (
    p_name,
    p_description,
    p_slate_name,
    p_slate_date,
    v_lock_time - INTERVAL '4 hours', -- Pool opens 4 hours before lock
    v_lock_time,
    v_end_time,
    p_entry_fee,
    (p_entry_fee * p_max_entries * 0.9), -- 90% payout
    p_max_entries,
    v_salary_cap,
    p_difficulty_tier,
    p_prize_type,
    p_is_guaranteed,
    p_is_featured,
    TRUE,
    'scheduled',
    p_admin_user_id
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  -- FIXED: Use game_date, home_team_tricode, away_team_tricode
  INSERT INTO dfs_pool_games (
    pool_id,
    game_id,
    game_date,
    home_team,
    away_team
  )
  SELECT 
    v_pool_id,
    g.game_id,
    g.game_date,
    g.home_team_tricode,
    g.away_team_tricode
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Auto-populate players from the selected games
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team, away_team]) as team_abbr
    FROM dfs_pool_games
    WHERE pool_id = v_pool_id
  )
  INSERT INTO dfs_player_salaries (
    pool_id,
    player_id,
    nba_player_id,
    player_name,
    player_team,
    player_position,
    salary,
    projected_points,
    is_active,
    is_playing
  )
  SELECT 
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    -- Use REAL NBA salary from hoopshype
    COALESCE(hs.salary_2025_26, 1157153) as salary, -- Default to NBA minimum
    35.0 as projected_points, -- TODO: Calculate from recent performance
    TRUE as is_active,
    TRUE as is_playing
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary statistics
  SELECT 
    MIN(salary),
    MAX(salary)
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries
  WHERE pool_id = v_pool_id;
  
  -- Log admin action
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    p_admin_user_id,
    'create',
    'dfs_pool',
    v_pool_id,
    jsonb_build_object(
      'pool_name', p_name,
      'games_count', v_games_added,
      'players_count', v_players_added,
      'difficulty', p_difficulty_tier,
      'entry_fee', p_entry_fee
    )
  );
  
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    v_min_salary,
    v_max_salary,
    TRUE,
    format('Pool created successfully with %s games and %s players', v_games_added, v_players_added)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_dfs_pool_from_games IS
'Admin function to create a DFS pool from selected NBA games.
Automatically populates players from teams playing in the selected games.
Uses REAL NBA salaries from nba_hoopshype_salaries table.
FIXED: Uses correct column names (game_date, home_team_tricode, away_team_tricode) from NBA CDN import.';

