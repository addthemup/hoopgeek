-- ============================================================================
-- Update DFS Pool Creation Function to Support Roster Configurations
-- ============================================================================

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
  p_is_featured BOOLEAN DEFAULT FALSE,
  p_starters_count INTEGER DEFAULT 5,
  p_rotation_count INTEGER DEFAULT 3,
  p_bench_count INTEGER DEFAULT 2
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
  
  -- Calculate roster size
  v_roster_size := p_starters_count + p_rotation_count + p_bench_count;
  
  -- Get lock time (earliest game start) and end time (latest game end)
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
    created_by_admin_id,
    roster_size,
    starters_count,
    rotation_count,
    bench_count,
    starters_multiplier,
    rotation_multiplier,
    bench_multiplier
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
    p_admin_user_id,
    v_roster_size,
    p_starters_count,
    p_rotation_count,
    p_bench_count,
    1.00,  -- starters multiplier
    0.75,  -- rotation multiplier
    0.50   -- bench multiplier
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
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
    FROM dfs_pool_games dpg
    WHERE dpg.pool_id = v_pool_id
  )
  INSERT INTO dfs_player_salaries (
    pool_id,
    player_id,
    nba_player_id,
    player_name,
    player_team,
    player_position,
    salary,
    is_active
  )
  SELECT 
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.name as player_name,
    p.team_abbreviation as player_team,
    p.position as player_position,
    COALESCE(
      hs.salary_2025_26,
      1157153  -- NBA minimum salary 2025-26 (0 years experience)
    ) as salary,
    TRUE
  FROM nba_players p
  JOIN game_teams gt ON p.team_abbreviation = gt.team_abbr
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.is_active = TRUE
    AND p.team_abbreviation IS NOT NULL;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary range
  SELECT 
    MIN(dps.salary)::BIGINT,
    MAX(dps.salary)::BIGINT
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries dps
  WHERE dps.pool_id = v_pool_id;
  
  -- Return success
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    COALESCE(v_min_salary, 0::BIGINT),
    COALESCE(v_max_salary, 0::BIGINT),
    TRUE,
    'Pool created successfully with ' || v_players_added || ' players from ' || v_games_added || ' games';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_dfs_pool_from_games IS
'Creates a DFS pool with games and auto-populates players.
Now supports custom roster configurations (compact: 5/3/2, full: 5/5/3).
Admin-only function that validates permissions before creating pool.';

